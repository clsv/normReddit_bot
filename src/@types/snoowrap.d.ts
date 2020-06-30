import * as Snoowrap from 'snoowrap';
import Submission, { ImagePreview, Media } from 'snoowrap/dist/objects/Submission';

declare module 'snoowrap' {
  interface IPreview {
    enabled: boolean;
    images: ImagePreview[];
    reddit_video_preview: any;
  }
  interface ExMedia extends Media{
    oembed?: {
      /** The username of the uploader of the source media */
      author_name?: string;
      /** URL to the author's profile on the source website */
      author_url?: string;
      description?: string;
      height: number;
      html: string;
      /** Name of the source website, e.g. "gfycat", "YouTube" */
      provider_name: string;
      /** URL of the source website, e.g. "https://www.youtube.com" */
      provider_url: string;
      thumbnail_height: number;
      thumbnail_url: string;
      thumbnail_width: number;
      /** Name of the media on the content site, e.g. YouTube video title */
      title: string;
      type: 'video' | 'rich';
      version: string;
      width: number;
      url?: string;
    };
  }

  export class ExtSubmission extends Submission {
    preview: IPreview;
    crosspost_parent_list: Array<ExtSubmission>;
  }
}

