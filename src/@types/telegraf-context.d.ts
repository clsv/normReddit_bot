//import { I18n } from 'telegraf-i18n';
//import { TelegrafTContext } from 'telegraf/typings/context'
import { Context } from 'telegraf'

declare module 'telegraf' {
  class TContext extends Context {
//    i18n: I18n;
    scene: any;
    session: {
      language: 'en' | 'ru';
      userId: number;
      isPostButtonEnabled: boolean;
      has18: boolean;
    };
    webhookReply: boolean;
  }
} 
