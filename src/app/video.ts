import { Injectable, signal } from '@angular/core';
import Peer from 'peerjs';
@Injectable({
  providedIn: 'root',
})
export class Video {
  private peer: Peer | any;
  public currentCall: any; // Added this to track the active call
  public myPeerId = signal<string>('');
  public remoteStream = signal<MediaStream | null>(null);
  public localStream = signal<MediaStream | null>(null);

  initPeer(userId: string) {
    this.peer = new Peer(userId);

    this.peer.on('open', (id: string) => {
      this.myPeerId.set(id);
      console.log('My Peer ID is: ' + id);
    });

    this.peer.on('call', async (call: any) => {
      this.currentCall = call; // Save the call object here!
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      this.localStream.set(stream);
      call.answer(stream);
      call.on('stream', (remoteStream: MediaStream) => {
        this.remoteStream.set(remoteStream);
      });
    });
  }

  async callUser(remotePeerId: string) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.localStream.set(stream);

    // Save the call object here too!
    this.currentCall = this.peer.call(remotePeerId, stream);

    this.currentCall.on('stream', (remoteStream: MediaStream) => {
      this.remoteStream.set(remoteStream);
    });
  }

  // Inside your Video class
  public isMuted = signal<boolean>(false);
  public isCameraOff = signal<boolean>(false);

  toggleMute() {
    const audioTrack = this.localStream()?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted.set(!audioTrack.enabled);
    }
  }

  toggleCamera() {
    const videoTrack = this.localStream()?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isCameraOff.set(!videoTrack.enabled);
    }
  }

  // For Mobile: Switch between Front and Back camera
  async flipCamera() {
    const currentStream = this.localStream();
    if (currentStream) {
      // Stop current tracks
      currentStream.getTracks().forEach((t) => t.stop());

      // Toggle facing mode (simplified logic)
      const constraints = {
        video: { facingMode: 'user' }, // or 'environment' for back camera
        audio: true,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream.set(newStream);

      // Update the active call with the new stream
      if (this.currentCall) {
        this.currentCall.peerConnection.getSenders().forEach((sender: any) => {
          if (sender.track.kind === 'video') {
            sender.replaceTrack(newStream.getVideoTracks()[0]);
          }
        });
      }
    }
  }
}
