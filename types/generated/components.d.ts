import type { Schema, Struct } from '@strapi/strapi';

export interface HomeComponentsLessonCard extends Struct.ComponentSchema {
  collectionName: 'components_home_components_lesson_cards';
  info: {
    displayName: 'lesson-card';
  };
  attributes: {
    audio_desc: Schema.Attribute.Media<'audios'> & Schema.Attribute.Required;
    thumbnail: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    title: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'home-components.lesson-card': HomeComponentsLessonCard;
    }
  }
}
