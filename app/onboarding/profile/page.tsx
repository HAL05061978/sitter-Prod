"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { lookupZipCode } from '../../lib/zipcode-utils';

export default function ParentProfileOnboarding() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [employer, setEmployer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const router = useRouter();

  // Get current user session
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleZipCodeChange = async (zip: string) => {
    setZipCode(zip);
    setCity(""); // Clear city while loading

    if (zip.length === 5) {
      // Look up ZIP code
      const zipInfo = await lookupZipCode(zip);
      if (zipInfo) {
        setCity(zipInfo.city);
      }
    }
  };

  // Image compression function for profile photos
  const compressProfileImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
          }

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to compress image'));
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Upload profile photo to Supabase Storage
  const handleProfilePhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingPhoto(true);
    setPhotoError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setPhotoError('Please select an image file');
        setUploadingPhoto(false);
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setPhotoError('Image file is too large. Please select an image under 10MB.');
        setUploadingPhoto(false);
        return;
      }

      // Compress the image
      const compressedBlob = await compressProfileImage(file);
      const compressedFile = new File(
        [compressedBlob],
        file.name,
        { type: 'image/jpeg' }
      );

      // Upload to Supabase Storage (profile-photos bucket)
      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setPhotoError('Failed to upload photo. Please try again.');
        setUploadingPhoto(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update the state with new photo URL
      setProfilePhotoUrl(publicUrl);
      setPhotoError(null);

      console.log('Profile photo uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      setPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!fullName || !phone) {
      setError('Full name and phone are required');
      setLoading(false);
      return;
    }

    // Validate phone number (10 digits)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Phone number must be 10 digits");
      setLoading(false);
      return;
    }

    // Validate ZIP code if provided
    if (zipCode && zipCode.length !== 5 && zipCode.length !== 0) {
      setError("ZIP code must be 5 digits");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert([
      {
        id: user?.id,
        full_name: fullName.trim(),
        email: user?.email,
        role: 'parent',
        phone: phone.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zipCode.trim() || null,
        bio: bio.trim() || null,
        profile_photo_url: profilePhotoUrl.trim() || null,
        emergency_contact: emergencyContact.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        profession: profession.trim() || null,
        employer: employer.trim() || null,
      },
    ]);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 sm:p-8 rounded shadow-md w-full max-w-3xl"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Create Your Parent Profile</h2>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded">{error}</div>}

        <div className="space-y-4">
          {/* Profile Photo Upload with Preview */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium">Profile Photo (Optional)</label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProfilePhotoUpload(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                <div
                  className={`p-2 rounded-lg transition flex items-center gap-2 ${
                    uploadingPhoto
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  title="Upload Photo from Camera/Gallery"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white text-sm font-medium">
                    {uploadingPhoto ? 'Uploading...' : 'Choose Photo'}
                  </span>
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-600 mt-1">Upload a photo from your camera or gallery (max 10MB, automatically compressed)</p>

            {/* Upload Status Messages */}
            {uploadingPhoto && (
              <p className="text-sm text-blue-600 mt-2">Uploading and compressing photo...</p>
            )}
            {photoError && (
              <p className="text-sm text-red-600 mt-2">{photoError}</p>
            )}

            {/* Preview */}
            {profilePhotoUrl && !uploadingPhoto && (
              <div className="mt-3 flex justify-center">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <img
                    src={profilePhotoUrl}
                    alt="Profile Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(123) 456-7890"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Profession</label>
              <input
                type="text"
                value={profession}
                onChange={e => setProfession(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Teacher, Engineer"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Employer</label>
              <input
                type="text"
                value={employer}
                onChange={e => setEmployer(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Company name"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">ZIP Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={e => handleZipCodeChange(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="City name"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CA"
                maxLength={2}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Emergency Contact Name</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={e => setEmergencyContact(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contact name"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Emergency Contact Phone</label>
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={e => setEmergencyContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(123) 456-7890"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 font-medium">Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Street address"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Bio / About Me</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>

          <div className="pt-2">
            <p className="text-sm text-gray-600 mb-4">* Required fields</p>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              disabled={loading}
            >
              {loading ? 'Creating Profile...' : 'Create Profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 