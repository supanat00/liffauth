
import React, { useState } from 'react';
import { S3 } from 'aws-sdk';
import Icon from './Icon';
import { useRouteParams } from '@/context/ParamsContext';

const s3 = new S3({
  region: process.env.NEXT_PUBLIC_AWS_REGION || '',
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});

interface MediaProps {
  downloadMedia: string | null;
  artistName: string;
}

const isAndroid = /Android/i.test(navigator.userAgent);

export const UploadToS3: React.FC<MediaProps> = ({ downloadMedia, artistName }) => {  
  const [fileUploadStatus, setFileUploadStatus] = useState<boolean>(false);
  const { params } = useRouteParams();

  const handleDownload = async () => {
    if (!downloadMedia) return;

    try {
      const response = await fetch(downloadMedia);
      const blob = await response.blob();

      // Determine file extension
      const fileExtension = blob.type.includes('image') ? 'png' : 'mp4';
      const mimeType = blob.type.includes('image') ? 'image/png' : 'video/mp4';
      const fileName = `${artistName}-download.${fileExtension}`;

      // Set image and video
      const file = new File([blob], fileName, { type: mimeType });
      uploadToS3(file);
      const fileUrl = URL.createObjectURL(file);

      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.click();

      // updateTransaction(params ? params.accessId : '', 'saveAndShare', 1);
      
      // Check if Web Share API supports file sharing
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
        if(isAndroid) {
          shareViaIntent(fileUrl);
        }
      } else {
        alert("Sharing is not supported on this browser.");
      }
    } catch (error) {
      console.error("Error sharing file:", error);
    }
  };

  const shareViaIntent = (fileUrl: string) => {
    const encodedUrl = encodeURIComponent(fileUrl);
    window.location.href = `intent:#Intent;action=android.intent.action.SEND;type=video/mp4;S.android.intent.extra.STREAM=${encodedUrl};end;`;
  };

  const uploadToS3 = async (file: File) => {
    if(params?.consent && params.age >= 20) {
      try {
        const uploadParams = {
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME || '',
          Key: `${params.userId}/${downloadMedia?.includes('data:image') ? 'image' : 'video'}/${Date.now()}_${file.name}`,
          Body: file,
          ContentType: file.type,
        };
      
        try {
          setFileUploadStatus(true);
          const result = await s3.upload(uploadParams).promise();
          alert('File upload success');
          setFileUploadStatus(false);
        } catch (err) {
          console.error('Error uploading file:', err);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('File upload failed');
      }
    }
  };

  // const updateTransaction = async (accessId: string, field: string, value: number) => {
  //   try {
  //     const response = await fetch('/api/updateTransaction', { 
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ accessId, field, value })
  //     });
  
  //     const data = await response.json();
  //     if (!response.ok) throw new Error(data.error);
  
  //   } catch (error) {
  //     console.error(`Error updating ${field}:`, error);
  //   }
  // };

  return (
    <>
    <a onClick={handleDownload}><Icon type='saveImg' /></a>
    <p className='text-xs mt-1 text-white'>{
      !fileUploadStatus ?
      (params?.consent ? 'Save & Share' : 'Save & Share') :
      (params?.consent ? 'Uploading...' : 'Save & Share')
    }</p>
    </>
  );
};

export default UploadToS3;
