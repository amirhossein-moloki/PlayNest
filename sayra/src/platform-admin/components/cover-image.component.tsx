/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Box,
  FormGroup,
  Label,
  Input,
  Button,
  DropZone,
  Text,
} from '@adminjs/design-system';
import { BasePropertyProps } from 'adminjs';

export const CoverImageComponent: React.FC<BasePropertyProps> = (props) => {
  const { property, record, onChange, where } = props;
  const currentVal = record?.params?.[property.name] || '';
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // In List or Show view, render image preview or empty placeholder
  if (where === 'list') {
    if (!currentVal) return <span>-</span>;
    return (
      <img
        src={currentVal}
        alt="Cover Preview"
        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
      />
    );
  }

  if (where === 'show') {
    return (
      <FormGroup>
        <Label>{property.label}</Label>
        {currentVal ? (
          <Box mt="default">
            <img
              src={currentVal}
              alt="Cover"
              style={{
                maxWidth: '320px',
                maxHeight: '220px',
                objectFit: 'cover',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'block',
                marginBottom: '8px',
              }}
            />
            <Text fontSize="sm" color="grey80">
              <a href={currentVal} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                {currentVal}
              </a>
            </Text>
          </Box>
        ) : (
          <Text color="grey60">No image uploaded</Text>
        )}
      </FormGroup>
    );
  }

  // Edit and New view: Direct file upload + preview + auto-setting coverImageUrl
  const handleFileUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      const platformToken = typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
      if (platformToken) {
        headers['Authorization'] = `Bearer ${platformToken}`;
      }

      // Perform upload directly to the platform admin media upload endpoint
      const response = await fetch('/api/v1/platform-admin/media/upload', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Image upload failed');
      }

      const uploadedUrl = json?.data?.url;
      if (!uploadedUrl) {
        throw new Error('No URL returned from upload server');
      }

      // Automatically set the coverImageUrl field on the record
      if (onChange) {
        onChange(property.name, uploadedUrl);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to upload image';
      setUploadError(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange(property.name, '');
    }
    setUploadError(null);
  };

  return (
    <FormGroup error={Boolean(uploadError || record?.errors?.[property.name])}>
      <Label required={property.isRequired}>{property.label}</Label>

      {/* Upload DropZone for direct file selection */}
      <Box mb="default">
        <DropZone
          files={[]}
          onChange={handleFileUpload}
          multiple={false}
          validate={{
            maxSize: 5 * 1024 * 1024,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          }}
        />
        {isUploading && (
          <Text fontSize="sm" color="primary" mt="sm">
            Uploading image to server...
          </Text>
        )}
        {uploadError && (
          <Text fontSize="sm" color="danger" mt="sm">
            {uploadError}
          </Text>
        )}
      </Box>

      {/* Preview and direct URL control */}
      {currentVal && (
        <Box mb="default" p="default" bg="white" style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src={currentVal}
              alt="Cover Preview"
              style={{
                width: '100px',
                height: '100px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            />
            <div style={{ flex: 1 }}>
              <Text fontSize="sm" fontWeight="bold" color="grey80">
                Active Cover Image URL
              </Text>
              <Text fontSize="xs" color="grey60" style={{ wordBreak: 'break-all', marginBottom: '8px' }}>
                {currentVal}
              </Text>
              <Button size="sm" variant="danger" type="button" onClick={handleClear}>
                Remove Image
              </Button>
            </div>
          </div>
        </Box>
      )}

      {/* Fallback manual URL input */}
      <Box mt="xs">
        <Text fontSize="xs" color="grey60" mb="xs">
          Image URL (automatically populated on file upload, or enter manually):
        </Text>
        <Input
          id={property.name}
          name={property.name}
          value={currentVal}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange && onChange(property.name, e.target.value)}
          placeholder="https://... or /uploads/..."
        />
      </Box>

      {record?.errors?.[property.name] && (
        <Text fontSize="sm" color="danger" mt="xs">
          {record.errors[property.name].message}
        </Text>
      )}
    </FormGroup>
  );
};

export default CoverImageComponent;
