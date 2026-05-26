import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private textract: TextractClient;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');

    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey:
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.s3 = new S3Client({
      region,
      credentials,
    });

    this.textract = new TextractClient({
      region,
      credentials,
    });
  }

  async uploadToS3(file: any) {
    const bucketName = this.configService.get<string>('AWS_BUCKET_NAME');

    const fileKey = `medical-files/${Date.now()}-${file.originalname}`;

    const s3Command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3.send(s3Command);

    let extractedText = '';

    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'application/pdf'
    ) {
      const textractCommand = new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: bucketName,
            Name: fileKey,
          },
        },
      });

      const textractResult = await this.textract.send(textractCommand);

      extractedText =
        textractResult.Blocks
          ?.filter((block) => block.BlockType === 'LINE')
          .map((block) => block.Text)
          .join('\n') || '';
    }

    return {
      message: 'Archivo subido a S3 y analizado con Textract',
      bucket: bucketName,
      key: fileKey,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      extractedText,
    };
  }
}