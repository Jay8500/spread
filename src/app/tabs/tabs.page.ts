import { Component, EnvironmentInjector, inject } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  triangle,
  ellipse,
  square,
  chatbubbles,
  person,
  settings,
  logOutOutline,
  chatbubblesOutline,
} from 'ionicons/icons';
@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor() {
    addIcons({
      triangle,
      ellipse,
      square,
      chatbubblesOutline,
      'chat-icon': chatbubbles, // Map 'chat-icon' to the chatbubbles SVG
      'profile-icon': person, // Map 'profile-icon' to the person SVG
      'settings-icon': settings, // Map 'settings-icon' to the settings SVG
      logout: logOutOutline,
    });
  }
}
