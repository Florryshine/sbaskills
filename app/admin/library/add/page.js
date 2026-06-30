import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';

const [coverFile, setCoverFile] = useState(null);
const [fileFile, setFileFile] = useState(null);
const [uploading, setUploading] = useState(false);

const handleUpload = async (file, folder) => {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const path = `${folder}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('books')
    .upload(path, file);
  if (error) throw error;
  // get public URL
  const { data: urlData } = supabase.storage
    .from('books')
    .getPublicUrl(path);
  return urlData.publicUrl;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setUploading(true);
  try {
    let coverUrl = form.cover_image_url;
    let fileUrl = form.file_url;
    if (coverFile) coverUrl = await handleUpload(coverFile, 'covers');
    if (fileFile) fileUrl = await handleUpload(fileFile, 'files');
    const { error } = await supabase.from('books').insert([{
      ...form,
      cover_image_url: coverUrl,
      file_url: fileUrl,
    }]);
    if (!error) router.push('/admin/library');
  } catch (err) {
    alert(err.message);
  }
  setUploading(false);
};

// In the form:
<input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files[0])} />
<input type="file" accept=".pdf,.epub,.mobi" onChange={e => setFileFile(e.target.files[0])} />