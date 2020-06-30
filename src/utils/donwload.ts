import fs from 'fs';
import https from 'https';
import url from 'url';


export const removeFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, checkOnError);
  }
};

export default function downloadFile(url: string, dest: fs.PathLike): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, response => {
      // check if response is success
      if (response.statusCode === 200) {
        response.pipe(file);
      } else {
        file.close();
        fs.unlink(dest, checkOnError);
        resolve(false);
      }
    });

    file.on('finish', () => {
      file.close();
      resolve(true);
    });

    file.on('error', err => {
      console.log(err);
      fs.unlink(dest, checkOnError);
      resolve(false);
    });

  });
}
interface FileParams {
  fileSize: number;
  width?: number;
  height?: number;
}
export const getRemoteFileParams = (fileUrl: string, type: 'image' | 'file' = 'image'): Promise<FileParams> => {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(fileUrl);
    const fileParams: FileParams = {
      fileSize: -1,
    };
    https.request({
      method: 'HEAD',
      protocol: 'https:',
      host: parsedUrl['hostname'],
      path: parsedUrl['path'],
    }, (res) => {
      if (res.statusCode === 200) {
        const { headers } = res;
        if (type === 'image') {
          const info = String(headers['fastly-io-info']);
          // const infoMatches = info.match(/ifsz=(\d+)\s+idim=((\d+)\x(\d+))/);
          const infoMatches = info.match(/ofsz\=(\d+)\s+odim\=(\d+)x(\d+)/);
          console.log(infoMatches);
          if (infoMatches !== null && infoMatches.length !== 0) {
            fileParams.fileSize = Number(infoMatches[1]);
            fileParams.height = Number(infoMatches[2]);
            fileParams.width = Number(infoMatches[3]);
          }
        } else {
          fileParams.fileSize = Number(headers['content-length']);
        }
        resolve(fileParams);
      } else {
        resolve(fileParams);
      }
    }).end();
  });
};


export const checkOnError = (err: any) => {
  if (err) {
    console.log(err);
  }
};