
import React, { useEffect, useState } from 'react';
import { S3 } from 'aws-sdk';
import { useUser } from '@/context/UserContext'; // Import Context
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
  uploadMedia: File | null;
  artistName: string;
}

const isAndroid = /Android/i.test(navigator.userAgent);

export const UploadToS3: React.FC<MediaProps> = ({ downloadMedia, uploadMedia, artistName }) => {  
  const [fileUploadStatus, setFileUploadStatus] = useState<boolean>(false);
  const { user } = useUser(); // ดึงข้อมูลผู้ใช้จาก Context
  const { params } = useRouteParams();

  useEffect(() => {
    if (user && params) {
      console.log('User Profile:', user);
      console.log('Param:', params);
    }
  }, [user, params]);

  const handleDownload = async () => {
    if (!downloadMedia) return;

    if (uploadMedia) uploadToS3(uploadMedia);

    try {
      const response = await fetch(downloadMedia);
      const blob = await response.blob();

      // Determine file extension
      const fileExtension = blob.type.includes('image') ? 'png' : 'mp4';
      const mimeType = blob.type.includes('image') ? 'image/png' : 'video/mp4';
      const fileName = `${artistName}-download.${fileExtension}`;

      // Set image and video
      const file = new File([blob], fileName, { type: mimeType });
      const fileUrl = URL.createObjectURL(file);

      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.click();
      
      // Check if Web Share API supports file sharing
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
        if(isAndroid) {
          shareViaIntent(fileUrl);
        }
        console.log("File shared successfully!");
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
    if(params?.consent) {
      try {
        const uploadParams = {
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME || '',
          Key: `${user?.userId}_${user?.displayName}/${downloadMedia?.includes('data:image') ? 'image' : 'video'}/${Date.now()}_${file.name}`,
          Body: file,
          ContentType: file.type,
        };
      
        try {
          setFileUploadStatus(true);
          const result = await s3.upload(uploadParams).promise();
          console.log('File uploaded successfully:', result);
          alert('File upload success');
          setFileUploadStatus(false);
        } catch (err) {
          console.error('Error uploading file:', err);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('File upload failed');
      }
    } else {
      console.log('Consent is FALSE, not upload.');
    }
  };

  return (
    <>
    <a className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'
    onClick={handleDownload}
    >
      <Icon type='save' />
    </a>
    <p className='text-xs mt-1 ml-[-10px]'>{
      !fileUploadStatus ?
      (params?.consent ? 'Save & Share' : 'Save & Share') :
      (params?.consent ? 'Uploading...' : 'Save & Share')
    }</p>
    </>
  );
};

export default UploadToS3;
