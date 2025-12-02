"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import LogoutButton from "../components/LogoutButton";
import type { User } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../../lib/email-service';
import { lookupZipCode } from '../lib/zipcode-utils';
import RescheduleModal from '../../components/care/RescheduleModal';
import ImageCropModal from '../../components/ImageCropModal';
import { useSwipeable } from 'react-swipeable';

interface Profile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  emergency_contact?: string | null;
  emergency_contact_phone?: string | null;
  profession?: string | null;
  employer?: string | null;
}

interface Child {
  id: string;
  full_name: string;
  birthdate: string | null;
  parent_id: string;
  created_at: string;
  school_name?: string | null;
  grade?: string | null;
  town?: string | null;
  zip_code?: string | null;
  photo_url?: string | null;
  parent_full_name?: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  age: number | null;
  birthdate: string | null;
  special_needs: string | null;
  notes: string | null;
  parent_id: string;
  created_at: string;
  photo_url?: string | null;
  parent_full_name?: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  group_type: 'care' | 'pet';
}

interface ChildGroupMember {
  id: string;
  child_id: string;
  group_id: string;
  added_by: string;
  added_at: string;
  active: boolean;
}

interface PetGroupMember {
  id: string;
  pet_id: string;
  group_id: string;
  added_by: string;
  added_at: string;
  active: boolean;
}

interface CareBlock {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  date: string;
  status: string;
  type: 'receiving' | 'providing' | 'event';
  group_id: string;
  related_request_id: string;
  group_name: string;
  parent_providing: string;
  child_participating: string;
  parent_notes: string;
  children: Array<{ id: string; full_name: string }>;
}


type TabType = 'profile' | 'children' | 'pets' | 'groups';

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<ChildGroupMember[]>([]);
  const [petMemberships, setPetMemberships] = useState<PetGroupMember[]>([]);
  const [allChildrenInGroups, setAllChildrenInGroups] = useState<Record<string, Child[]>>({});
  const [allPetsInGroups, setAllPetsInGroups] = useState<Record<string, Pet[]>>({});
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editProfilePhotoUrl, setEditProfilePhotoUrl] = useState("");
  const [editEmergencyContact, setEditEmergencyContact] = useState("");
  const [editEmergencyContactPhone, setEditEmergencyContactPhone] = useState("");
  const [editProfession, setEditProfession] = useState("");
  const [editEmployer, setEditEmployer] = useState("");
  const [profileEditError, setProfileEditError] = useState("");
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);

  // Children state
  const [uploadingChildPhoto, setUploadingChildPhoto] = useState(false);
  const [childPhotoError, setChildPhotoError] = useState<string | null>(null);
  const [editChildPhotoUrl, setEditChildPhotoUrl] = useState("");
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState("");
  const [editChildBirthdate, setEditChildBirthdate] = useState("");
  const [editChildSchoolName, setEditChildSchoolName] = useState("");
  const [editChildGrade, setEditChildGrade] = useState("");
  const [editChildTown, setEditChildTown] = useState("");
  const [editChildZipCode, setEditChildZipCode] = useState("");
  const [childEditError, setChildEditError] = useState("");
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirthdate, setChildBirthdate] = useState("");
  const [childSchoolName, setChildSchoolName] = useState("");
  const [childGrade, setChildGrade] = useState("");
  const [childTown, setChildTown] = useState("");
  const [childZipCode, setChildZipCode] = useState("");
  const [availableSchools, setAvailableSchools] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [missingSchoolName, setMissingSchoolName] = useState("");
  const [showMissingSchoolInput, setShowMissingSchoolInput] = useState(false);
  const [editAvailableSchools, setEditAvailableSchools] = useState<any[]>([]);
  const [editLoadingSchools, setEditLoadingSchools] = useState(false);
  const [editMissingSchoolName, setEditMissingSchoolName] = useState("");
  const [editShowMissingSchoolInput, setEditShowMissingSchoolInput] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [childError, setChildError] = useState("");

  // Pets state
  const [showAddPet, setShowAddPet] = useState(false);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petAge, setPetAge] = useState("");
  const [petBirthdate, setPetBirthdate] = useState("");
  const [petSpecialNeeds, setPetSpecialNeeds] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const [addingPet, setAddingPet] = useState(false);
  const [petError, setPetError] = useState("");
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [editPetName, setEditPetName] = useState("");
  const [editPetSpecies, setEditPetSpecies] = useState("");
  const [editPetBreed, setEditPetBreed] = useState("");
  const [editPetAge, setEditPetAge] = useState("");
  const [editPetBirthdate, setEditPetBirthdate] = useState("");
  const [editPetSpecialNeeds, setEditPetSpecialNeeds] = useState("");
  const [editPetNotes, setEditPetNotes] = useState("");
  const [petEditError, setPetEditError] = useState("");
  const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
  const [petPhotoError, setPetPhotoError] = useState<string | null>(null);
  const [editPetPhotoUrl, setEditPetPhotoUrl] = useState("");

  // Groups state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [invitingGroupId, setInvitingGroupId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupType, setEditGroupType] = useState<'care' | 'pet'>('care');
  const [groupEditError, setGroupEditError] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<'care' | 'pet'>('care');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupManagementError, setGroupManagementError] = useState("");

  // State for popup
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<CareBlock[]>([]);
  const [popupType, setPopupType] = useState<'receiving' | 'providing' | 'event'>('receiving');
  const [popupTitle, setPopupTitle] = useState('');
  
  // State for reschedule modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedCareBlock, setSelectedCareBlock] = useState<any>(null);
  const [rescheduleSuccessMessage, setRescheduleSuccessMessage] = useState('');

  // State for image cropping
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'profile' | 'child' | 'pet' | null>(null);

  // Tab order for swipe navigation
  const tabOrder: TabType[] = ['profile', 'groups', 'children', 'pets'];

  // Swipe handlers for tab navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex < tabOrder.length - 1) {
        setActiveTab(tabOrder[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabOrder[currentIndex - 1]);
      }
    },
    trackMouse: false, // Only track touch, not mouse
    preventScrollOnSwipe: false, // Allow vertical scrolling
    delta: 50, // Minimum swipe distance
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setUser(data.user);
        
        // Fetch profile from 'profiles' table
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, phone, role, address, city, state, zip_code, bio, profile_photo_url, emergency_contact, emergency_contact_phone, profession, employer") // Select all profile fields
          .eq("id", data.user.id)
          .single();
        
        // Check if user is a tutor and redirect them
        if (profileData?.role === "tutor") {
          router.replace("/tutor-dashboard");
          return;
        }
        
        setProfile(profileData as Profile | null);

        // Check if user has pending children in metadata (from signup)
        const pendingChildren = data.user.user_metadata?.pending_children;
        if (pendingChildren && Array.isArray(pendingChildren) && pendingChildren.length > 0) {
          console.log('Found pending children in metadata:', pendingChildren);

          // First, clear the metadata to prevent duplicates
          await supabase.auth.updateUser({
            data: {
              pending_children: null
            }
          });

          // Create children records
          for (const child of pendingChildren) {
            const { error } = await supabase
              .from('children')
              .insert({
                full_name: child.name,
                birthdate: child.birthdate,
                school_name: child.schoolName,
                grade: child.grade,
                town: child.town,
                zip_code: child.zipCode,
                parent_id: data.user.id
              });

            if (error) {
              console.error('Error creating child:', error);
            }
          }

          console.log('Pending children created successfully');
        }

        // Fetch children for this parent
        const { data: childrenData } = await supabase
          .from("children")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setChildren(childrenData || []);

        // Fetch pets for this parent
        const { data: petsData } = await supabase
          .from("pets")
          .select("*")
          .eq("parent_id", data.user.id)
          .order("created_at", { ascending: false });
        setPets(petsData || []);

        // Fetch all groups (created and joined)
        await loadGroups(data.user.id, childrenData || []);

        setLoading(false);
      }
    });
  }, [router]);

  // Reload groups when children or pets change
  useEffect(() => {
    if (user) {
      loadGroups(user.id, children);
    }
  }, [children, pets, user]);

  const loadGroups = async (userId: string, childrenData: Child[]) => {
    // 1. Fetch groups created by this parent
    const { data: createdGroups } = await supabase
      .from("groups")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    // 2. Fetch groups where this parent is a member (through invites)
    const { data: memberGroups } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("profile_id", userId)
      .eq("status", "active");

    let memberGroupIds: string[] = [];
    if (memberGroups) {
      memberGroupIds = memberGroups.map(mg => mg.group_id);
    }

    const { data: joinedGroups } = await supabase
      .from("groups")
      .select("*")
      .in("id", memberGroupIds)
      .order("created_at", { ascending: false });

    // 3. Combine and deduplicate groups
    const allGroups = [...(createdGroups || []), ...(joinedGroups || [])];
    const uniqueGroups = allGroups.filter((group, index, self) =>
      index === self.findIndex(g => g.id === group.id)
    );
    setGroups(uniqueGroups);

    // 4. Fetch all child-group memberships for parent's children
    if (childrenData.length > 0) {
      const childIds = childrenData.map(child => child.id);
      const { data: membershipsData, error: membershipsError } = await supabase
        .from("child_group_members")
        .select("*")
        .in("child_id", childIds)
        .eq("active", true); // Only fetch active memberships

      if (membershipsError) {
        console.error('Error loading memberships:', membershipsError);
      } else {
        setMemberships(membershipsData || []);
      }
    }

    // 4b. Fetch all pet-group memberships for parent's pets
    if (pets.length > 0) {
      const petIds = pets.map(pet => pet.id);
      const { data: petMembershipsData, error: petMembershipsError } = await supabase
        .from("pet_group_members")
        .select("*")
        .in("pet_id", petIds)
        .eq("active", true);

      if (petMembershipsError) {
        console.error('Error loading pet memberships:', petMembershipsError);
      } else {
        setPetMemberships(petMembershipsData || []);
      }
    }

    // 5. Fetch all children for each group (including other parents' children)
    if (uniqueGroups && uniqueGroups.length > 0) {
      const groupIds = uniqueGroups.map(group => group.id);
      const { data: allMemberships } = await supabase
        .from("child_group_members")
        .select("*")
        .in("group_id", groupIds)
        .eq("active", true); // Only fetch active memberships

      if (allMemberships && allMemberships.length > 0) {
        const allChildIds = Array.from(new Set(allMemberships.map(m => m.child_id)));
        const { data: allChildrenData } = await supabase
          .from("children")
          .select("*, profiles!parent_id(full_name)")
          .in("id", allChildIds);

        if (allChildrenData) {
          // Map children data and add parent_full_name from the joined profiles table
          const childrenWithParentNames = allChildrenData.map((child: any) => ({
            ...child,
            parent_full_name: child.profiles?.full_name || null
          }));

          const childrenMap: Record<string, Child[]> = {};
          uniqueGroups.forEach(group => {
            const groupMemberships = allMemberships.filter(m => m.group_id === group.id);
            childrenMap[group.id] = groupMemberships
              .map(membership => childrenWithParentNames.find(child => child.id === membership.child_id))
              .filter(Boolean) as Child[];
          });
          setAllChildrenInGroups(childrenMap);
        }
      }

      // 5b. Fetch all pets for each group (including other parents' pets)
      const { data: allPetMemberships } = await supabase
        .from("pet_group_members")
        .select("*")
        .in("group_id", groupIds)
        .eq("active", true);

      if (allPetMemberships && allPetMemberships.length > 0) {
        const allPetIds = Array.from(new Set(allPetMemberships.map(m => m.pet_id)));

        // Fetch pets data
        const { data: allPetsData } = await supabase
          .from("pets")
          .select("*")
          .in("id", allPetIds);

        if (allPetsData) {
          // Get unique parent IDs from the pets
          const parentIds = Array.from(new Set(allPetsData.map(pet => pet.parent_id).filter(Boolean)));

          // Fetch parent profiles
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", parentIds);

          // Create a map of parent_id to full_name
          const parentNamesMap = new Map(
            (profilesData || []).map((profile: any) => [profile.id, profile.full_name])
          );

          // Map pets data and add parent_full_name from the profiles map
          const petsWithParentNames = allPetsData.map((pet: any) => ({
            ...pet,
            parent_full_name: parentNamesMap.get(pet.parent_id) || null
          }));

          const petsMap: Record<string, Pet[]> = {};
          uniqueGroups.forEach(group => {
            const groupPetMemberships = allPetMemberships.filter(m => m.group_id === group.id);
            petsMap[group.id] = groupPetMemberships
              .map(membership => petsWithParentNames.find(pet => pet.id === membership.pet_id))
              .filter(Boolean) as Pet[];
          });
          setAllPetsInGroups(petsMap);
        }
      }
    }
  };


  const handleRescheduleClick = (careBlock: any) => {
    setSelectedCareBlock(careBlock);
    setShowRescheduleModal(true);
  };

  const handleRescheduleSuccess = () => {
    // Show success message
    setRescheduleSuccessMessage('Reschedule request created successfully! Parents will be notified to accept or decline.');

    // Clear message after 5 seconds
    setTimeout(() => setRescheduleSuccessMessage(''), 5000);

    setShowRescheduleModal(false);
    setSelectedCareBlock(null);
  };

  // Function to close popup
  const closePopup = () => {
    setShowPopup(false);
    setPopupData([]);
  };

  // Add this helper function to get children for a specific care block
  const getChildrenForCareBlock = async (careBlockId: string) => {
    try {
      const { data: careChildren, error } = await supabase
        .from('scheduled_care_children')
        .select(`
          children(id, full_name)
        `)
        .eq('scheduled_care_id', careBlockId);
      
      if (error) {
        console.error('Error fetching care block children:', error);
        return [];
      }
      
      return (careChildren || []).map(cc => cc.children).filter(Boolean);
    } catch (error) {
      console.error('Error in getChildrenForCareBlock:', error);
      return [];
    }
  };

  // Helper to format phone number as (XXX) XXX XXXX
  function formatPhone(phone?: string | null) {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  // Helper to calculate age from birthdate
  function calculateAge(birthdate: string | null): number | null {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Helper to format birthdate for display
  function formatBirthdate(birthdate: string | null): string {
    if (!birthdate) return "Not set";
    return new Date(birthdate + 'T00:00:00').toLocaleDateString();
  }

  // Helper to check if a child is a member of a group
  function isChildInGroup(childId: string, groupId: string) {
    const membership = memberships.find(
      (m) => m.child_id === childId && m.group_id === groupId && m.active !== false
    );
    console.log(`Checking membership for child ${childId} in group ${groupId}:`, membership);
    return membership;
  }

  // Helper to check if a pet is a member of a group
  function isPetInGroup(petId: string, groupId: string) {
    const membership = petMemberships.find(
      (m) => m.pet_id === petId && m.group_id === groupId && m.active !== false
    );
    console.log(`Checking membership for pet ${petId} in group ${groupId}:`, membership);
    return membership;
  }

  // Check if user is the creator of a group
  function isGroupCreator(group: Group) {
    return group.created_by === user?.id;
  }

  // Image compression function for profile photos
  const compressProfileImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;  // Smaller size for profile photos
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

  // Handle file selection - show crop modal
  const handleFileSelect = (file: File, type: 'profile' | 'child' | 'pet') => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      if (type === 'profile') setProfilePhotoError('Please select an image file');
      else if (type === 'child') setChildPhotoError('Please select an image file');
      else setPetPhotoError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const errorMsg = 'Image file is too large. Please select an image under 10MB.';
      if (type === 'profile') setProfilePhotoError(errorMsg);
      else if (type === 'child') setChildPhotoError(errorMsg);
      else setPetPhotoError(errorMsg);
      return;
    }

    // Convert to data URL for cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCropType(type);
    };
    reader.readAsDataURL(file);
  };

  // Handle cropped image - compress and upload
  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!user || !cropType) return;

    // Set uploading state based on type
    if (cropType === 'profile') {
      setUploadingProfilePhoto(true);
      setProfilePhotoError(null);
    } else if (cropType === 'child') {
      setUploadingChildPhoto(true);
      setChildPhotoError(null);
    } else {
      setUploadingPetPhoto(true);
      setPetPhotoError(null);
    }

    // Close crop modal
    setImageToCrop(null);
    setCropType(null);

    try {
      // Compress the cropped image
      const compressedBlob = await compressProfileImage(
        new File([croppedBlob], 'cropped.jpg', { type: 'image/jpeg' })
      );
      const compressedFile = new File(
        [compressedBlob],
        'cropped.jpg',
        { type: 'image/jpeg' }
      );

      // Determine bucket based on type
      const bucket = cropType === 'profile' ? 'profile-photos' :
                     cropType === 'child' ? 'children-photos' : 'pet-photos';

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}_cropped.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload photo');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // Update the appropriate state with new photo URL
      if (cropType === 'profile') {
        setEditProfilePhotoUrl(publicUrl);
        setProfilePhotoError(null);
      } else if (cropType === 'child') {
        setEditChildPhotoUrl(publicUrl);
        setChildPhotoError(null);
      } else {
        setEditPetPhotoUrl(publicUrl);
        setPetPhotoError(null);
      }

      console.log(`${cropType} photo uploaded successfully:`, publicUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      const errorMsg = 'Failed to upload photo. Please try again.';
      if (cropType === 'profile') setProfilePhotoError(errorMsg);
      else if (cropType === 'child') setChildPhotoError(errorMsg);
      else setPetPhotoError(errorMsg);
    } finally {
      // Reset uploading state
      if (cropType === 'profile') setUploadingProfilePhoto(false);
      else if (cropType === 'child') setUploadingChildPhoto(false);
      else setUploadingPetPhoto(false);
    }
  };

  // Cancel crop modal
  const handleCancelCrop = () => {
    setImageToCrop(null);
    setCropType(null);
  };

  // Upload profile photo to Supabase Storage
  const handleProfilePhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingProfilePhoto(true);
    setProfilePhotoError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setProfilePhotoError('Please select an image file');
        setUploadingProfilePhoto(false);
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setProfilePhotoError('Image file is too large. Please select an image under 10MB.');
        setUploadingProfilePhoto(false);
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
        setProfilePhotoError('Failed to upload photo. Please try again.');
        setUploadingProfilePhoto(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update the edit state with new photo URL
      setEditProfilePhotoUrl(publicUrl);
      setProfilePhotoError(null);

      console.log('Profile photo uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      setProfilePhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingProfilePhoto(false);
    }
  };

  // Upload child photo to Supabase Storage
  const handleChildPhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingChildPhoto(true);
    setChildPhotoError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setChildPhotoError('Please select an image file');
        setUploadingChildPhoto(false);
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setChildPhotoError('Image file is too large. Please select an image under 10MB.');
        setUploadingChildPhoto(false);
        return;
      }

      // Compress the image
      const compressedBlob = await compressProfileImage(file);
      const compressedFile = new File(
        [compressedBlob],
        file.name,
        { type: 'image/jpeg' }
      );

      // Upload to Supabase Storage (children-photos bucket)
      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('children-photos')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setChildPhotoError('Failed to upload photo. Please try again.');
        setUploadingChildPhoto(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('children-photos')
        .getPublicUrl(fileName);

      // Update the edit state with new photo URL
      setEditChildPhotoUrl(publicUrl);
      setChildPhotoError(null);

      console.log('Child photo uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      setChildPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingChildPhoto(false);
    }
  };

  // Upload pet photo to Supabase Storage
  const handlePetPhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingPetPhoto(true);
    setPetPhotoError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setPetPhotoError('Please select an image file');
        setUploadingPetPhoto(false);
        return;
      }

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setPetPhotoError('Image file is too large. Please select an image under 10MB.');
        setUploadingPetPhoto(false);
        return;
      }

      // Compress the image
      const compressedBlob = await compressProfileImage(file);
      const compressedFile = new File(
        [compressedBlob],
        file.name,
        { type: 'image/jpeg' }
      );

      // Upload to Supabase Storage (pet-photos bucket)
      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setPetPhotoError('Failed to upload photo. Please try again.');
        setUploadingPetPhoto(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pet-photos')
        .getPublicUrl(fileName);

      // Update the edit state with new photo URL
      setEditPetPhotoUrl(publicUrl);
      setPetPhotoError(null);

      console.log('Pet photo uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Photo upload error:', error);
      setPetPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  // Profile handlers
  function handleEditProfile() {
    setEditingProfile(true);
    setEditFullName(profile?.full_name || "");
    setEditEmail(profile?.email || "");
    setEditPhone(profile?.phone || "");
    setEditAddress(profile?.address || "");
    setEditCity(profile?.city || "");
    setEditState(profile?.state || "");
    setEditZipCode(profile?.zip_code || "");
    setEditBio(profile?.bio || "");
    setEditProfilePhotoUrl(profile?.profile_photo_url || "");
    setEditEmergencyContact(profile?.emergency_contact || "");
    setEditEmergencyContactPhone(profile?.emergency_contact_phone || "");
    setEditProfession(profile?.profession || "");
    setEditEmployer(profile?.employer || "");
    setProfileEditError("");
  }

  async function handleSaveProfile() {
    setProfileEditError("");

    if (!editFullName.trim()) {
      setProfileEditError("Full name is required");
      return;
    }

    if (!editPhone.trim()) {
      setProfileEditError("Phone is required");
      return;
    }

    // Format phone number for validation (remove all non-digits)
    const phoneDigits = editPhone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setProfileEditError("Phone number must be 10 digits");
      return;
    }

    // Validate ZIP code if provided
    if (editZipCode && editZipCode.length !== 5 && editZipCode.length !== 0) {
      setProfileEditError("ZIP code must be 5 digits");
      return;
    }

    const updateData: any = {
      full_name: editFullName.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim() || null,
      city: editCity.trim() || null,
      state: editState.trim() || null,
      zip_code: editZipCode.trim() || null,
      bio: editBio.trim() || null,
      profile_photo_url: editProfilePhotoUrl.trim() || null,
      emergency_contact: editEmergencyContact.trim() || null,
      emergency_contact_phone: editEmergencyContactPhone.trim() || null,
      profession: editProfession.trim() || null,
      employer: editEmployer.trim() || null,
    };

    console.log('Updating profile with data:', updateData);

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user?.id)
      .select();

    console.log('Update result:', { data, error });

    if (error) {
      setProfileEditError(error.message);
      return;
    }

    // Update local state
    setProfile(data[0] as Profile);
    setEditingProfile(false);
  }

  function handleCancelProfileEdit() {
    setEditingProfile(false);
    setProfileEditError("");
  }

  async function handleProfileZipCodeChange(zip: string) {
    setEditZipCode(zip);
    setEditCity(""); // Clear city while loading

    if (zip.length === 5) {
      // Look up ZIP code
      const zipInfo = await lookupZipCode(zip);
      if (zipInfo) {
        setEditCity(zipInfo.city);
      }
    }
  }

  // Children handlers
  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childName.trim() || !childBirthdate.trim()) {
      setChildError("Please fill in all fields");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (childBirthdate > todayStr) {
      setChildError("Birthdate cannot be in the future");
      return;
    }

    const age = calculateAge(childBirthdate);
    if (age !== null && (age < 0 || age > 18)) {
      setChildError("Child must be between 0 and 18 years old");
      return;
    }

    setAddingChild(true);
    setChildError("");

    const { error } = await supabase.from("children").insert([
      {
        full_name: childName.trim(),
        birthdate: childBirthdate,
        parent_id: user.id,
        school_name: childSchoolName.trim() || null,
        grade: childGrade.trim() || null,
        town: childTown.trim() || null,
        zip_code: childZipCode.trim() || null,
      },
    ]);

    setAddingChild(false);
    if (error) {
      setChildError(error.message);
    } else {
      // Send notification if user entered a missing school
      if (showMissingSchoolInput && missingSchoolName && childZipCode) {
        await notifyMissingSchool(missingSchoolName, childZipCode, childTown);
      }

      const { data: childrenData } = await supabase
        .from("children")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });
      setChildren(childrenData || []);

      setChildName("");
      setChildBirthdate("");
      setChildSchoolName("");
      setChildGrade("");
      setChildTown("");
      setChildZipCode("");
      setShowMissingSchoolInput(false);
      setMissingSchoolName("");
      setShowAddChild(false);
    }
  };

  async function handleEditChild(child: Child) {
    setEditingChildId(child.id);
    setEditChildName(child.full_name);
    setEditChildBirthdate(child.birthdate || "");
    setEditChildSchoolName(child.school_name || "");
    setEditChildGrade(child.grade || "");
    setEditChildTown(child.town || "");
    setEditChildZipCode(child.zip_code || "");
    setEditChildPhotoUrl(child.photo_url || "");
    setChildEditError("");
    setChildPhotoError(null);

    // Load schools if ZIP code exists
    if (child.zip_code && child.zip_code.length === 5) {
      setEditLoadingSchools(true);
      const { data: schools, error } = await supabase
        .from('schools')
        .select('*')
        .eq('zip_code', child.zip_code)
        .order('name');

      if (!error && schools) {
        setEditAvailableSchools(schools);
      }
      setEditLoadingSchools(false);
    }
  }

  async function handleSaveChildEdit(child: Child) {
    setChildEditError("");
    if (!editChildName.trim()) {
      setChildEditError("Child name is required");
      return;
    }
    if (!editChildBirthdate.trim()) {
      setChildEditError("Birthdate is required");
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (editChildBirthdate > todayStr) {
      setChildEditError("Birthdate cannot be in the future");
      return;
    }

    const updateData = {
      full_name: editChildName.trim(),
      birthdate: editChildBirthdate,
      school_name: editChildSchoolName?.trim() || null,
      grade: editChildGrade?.trim() || null,
      town: editChildTown?.trim() || null,
      zip_code: editChildZipCode?.trim() || null,
      photo_url: editChildPhotoUrl?.trim() || null,
    };

    console.log('Updating child with data:', updateData);

    const { data, error } = await supabase
      .from("children")
      .update(updateData)
      .eq("id", child.id)
      .eq("parent_id", user?.id)
      .select();

    console.log('Update result:', { data, error });

    if (error) {
      setChildEditError(error.message);
      return;
    }

    const { data: childrenData, error: fetchError } = await supabase
      .from("children")
      .select("*")
      .eq("parent_id", user?.id)
      .order("created_at", { ascending: false });

    console.log('Fetched children after update:', childrenData);

    if (fetchError) {
      setChildEditError(fetchError.message);
      return;
    }
    setChildren(childrenData || []);
    setEditingChildId(null);
  }

  function handleCancelChildEdit() {
    setEditingChildId(null);
    setChildEditError("");
  }

  // Handle ZIP code change and auto-populate town (for add child)
  async function handleChildZipCodeChange(zip: string) {
    setChildZipCode(zip);
    setChildTown(""); // Clear town while loading
    setAvailableSchools([]); // Clear schools

    if (zip.length === 5) {
      // Look up ZIP code
      const zipInfo = await lookupZipCode(zip);
      if (zipInfo) {
        setChildTown(zipInfo.city);
      }

      // Fetch schools for this ZIP code
      setLoadingSchools(true);
      const { data: schools, error } = await supabase
        .from('schools')
        .select('*')
        .eq('zip_code', zip)
        .order('name');

      if (!error && schools) {
        setAvailableSchools(schools);
      }
      setLoadingSchools(false);
    }
  }

  // Handle ZIP code change and auto-populate town (for edit child)
  async function handleEditChildZipCodeChange(zip: string) {
    setEditChildZipCode(zip);
    setEditChildTown(""); // Clear town while loading
    setEditAvailableSchools([]); // Clear schools

    if (zip.length === 5) {
      // Look up ZIP code
      const zipInfo = await lookupZipCode(zip);
      if (zipInfo) {
        setEditChildTown(zipInfo.city);
      }

      // Fetch schools for this ZIP code
      setEditLoadingSchools(true);
      const { data: schools, error } = await supabase
        .from('schools')
        .select('*')
        .eq('zip_code', zip)
        .order('name');

      if (!error && schools) {
        setEditAvailableSchools(schools);
      }
      setEditLoadingSchools(false);
    }
  }

  // Send email notification about missing school
  async function notifyMissingSchool(schoolName: string, zipCode: string, town: string) {
    try {
      console.log('Sending missing school notification:', { schoolName, zipCode, town });

      // Use the email service to send notification
      await emailService.sendEmail({
        to: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com', // Set this in your env
        subject: `Missing School: ${schoolName} in ${town} (${zipCode})`,
        html: `
          <h2>Missing School Notification</h2>
          <p>A user has reported a school that is not in the database:</p>
          <ul>
            <li><strong>School Name:</strong> ${schoolName}</li>
            <li><strong>ZIP Code:</strong> ${zipCode}</li>
            <li><strong>Town:</strong> ${town}</li>
          </ul>
          <p>Please add this school to the database if appropriate.</p>
          <p><em>Reported by user: ${user?.email || 'Unknown'}</em></p>
        `,
        text: `Missing School: ${schoolName}\nZIP Code: ${zipCode}\nTown: ${town}\n\nReported by: ${user?.email || 'Unknown'}`
      });

      console.log('Missing school notification sent successfully');
    } catch (error) {
      console.error('Error sending missing school notification:', error);
      // Don't throw - we don't want to block the user's flow
    }
  }

  // Pets handlers
  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !petName.trim()) {
      setPetError("Please enter a pet name");
      return;
    }

    setAddingPet(true);
    setPetError("");

    const { data, error } = await supabase.from("pets").insert([
      {
        parent_id: user.id,
        name: petName.trim(),
        species: petSpecies.trim() || null,
        breed: petBreed.trim() || null,
        age: petAge ? parseInt(petAge) : null,
        birthdate: petBirthdate || null,
        special_needs: petSpecialNeeds.trim() || null,
        notes: petNotes.trim() || null,
      },
    ]).select();

    setAddingPet(false);
    if (error) {
      setPetError(error.message);
    } else {
      if (data) {
        setPets([...pets, data[0]]);
      }
      setPetName("");
      setPetSpecies("");
      setPetBreed("");
      setPetAge("");
      setPetBirthdate("");
      setPetSpecialNeeds("");
      setPetNotes("");
      setShowAddPet(false);
    }
  };

  function handleEditPet(pet: Pet) {
    setEditingPetId(pet.id);
    setEditPetName(pet.name);
    setEditPetSpecies(pet.species || "");
    setEditPetBreed(pet.breed || "");
    setEditPetAge(pet.age?.toString() || "");
    setEditPetBirthdate(pet.birthdate || "");
    setEditPetSpecialNeeds(pet.special_needs || "");
    setEditPetNotes(pet.notes || "");
    setEditPetPhotoUrl(pet.photo_url || "");
    setPetEditError("");
    setPetPhotoError(null);
  }

  async function handleSavePetEdit(pet: Pet) {
    setPetEditError("");
    if (!editPetName.trim()) {
      setPetEditError("Pet name is required");
      return;
    }
    const { data, error } = await supabase
      .from("pets")
      .update({
        name: editPetName.trim(),
        species: editPetSpecies.trim() || null,
        breed: editPetBreed.trim() || null,
        age: editPetAge ? parseInt(editPetAge) : null,
        birthdate: editPetBirthdate || null,
        special_needs: editPetSpecialNeeds.trim() || null,
        notes: editPetNotes.trim() || null,
        photo_url: editPetPhotoUrl?.trim() || null,
      })
      .eq("id", pet.id)
      .eq("parent_id", user?.id)
      .select();
    if (error) {
      setPetEditError(error.message);
      return;
    }
    const { data: petsData, error: fetchError } = await supabase
      .from("pets")
      .select("*")
      .eq("parent_id", user?.id)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setPetEditError(fetchError.message);
      return;
    }
    setPets(petsData || []);
    setEditingPetId(null);
  }

  function handleCancelPetEdit() {
    setEditingPetId(null);
    setPetEditError("");
  }

  // Groups handlers
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim()) {
      setGroupError("Please enter a group name");
      return;
    }

    setAddingGroup(true);
    setGroupError("");

    const { data: groupInsertData, error: groupInsertError } = await supabase
      .from("groups")
      .insert([
        {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          created_by: user.id,
          group_type: groupType,
        },
      ])
      .select();
    if (groupInsertError) {
      setAddingGroup(false);
      setGroupError(groupInsertError.message);
      return;
    }
    const newGroup = groupInsertData && groupInsertData[0];
    if (!newGroup) {
      setAddingGroup(false);
      setGroupError("Failed to create group.");
      return;
    }
    const { error: memberInsertError } = await supabase
      .from("group_members")
      .insert([
        {
          group_id: newGroup.id,
          profile_id: user.id,
          role: 'parent',
          joined_at: new Date().toISOString(),
        },
      ]);
    setAddingGroup(false);
    if (memberInsertError) {
      setGroupError("Group created, but failed to add you as a member: " + memberInsertError.message);
      return;
    }
    await loadGroups(user.id, children);
    setGroupName("");
    setGroupDescription("");
    setGroupType('care');
    setShowAddGroup(false);
  };

  function handleEditGroup(group: Group) {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || "");
    setEditGroupType(group.group_type);
    setGroupEditError("");
  }

  async function handleSaveGroupEdit(group: Group) {
    setGroupEditError("");
    if (!editGroupName.trim()) {
      setGroupEditError("Group name is required");
      return;
    }
    const { error } = await supabase
      .from("groups")
      .update({ 
        name: editGroupName.trim(), 
        description: editGroupDescription.trim(),
        group_type: editGroupType
      })
      .eq("id", group.id)
      .eq("created_by", user?.id)
      .select();
    if (error) {
      setGroupEditError(error.message);
      return;
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? { ...g, name: editGroupName.trim(), description: editGroupDescription.trim(), group_type: editGroupType }
          : g
      )
    );
    setEditingGroupId(null);
  }

  function handleCancelGroupEdit() {
    setEditingGroupId(null);
    setGroupEditError("");
  }

  function handleInviteGroup(group: Group) {
    setInvitingGroupId(group.id);
    setInviteEmail("");
    setInviteNote("");
    setInviteError("");
  }

  function handleCancelInvite() {
    setInvitingGroupId(null);
    setInviteError("");
    setInviteEmail("");
    setInviteNote("");
    setSendingInvite(false);
  }

  async function handleSubmitInvite(e: React.FormEvent, group: Group) {
    e.preventDefault();
    setSendingInvite(true);
    setInviteError("");
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      setSendingInvite(false);
      return;
    }

    // Check if the user is trying to invite themselves
    if (profile?.email && inviteEmail.trim().toLowerCase() === profile.email.toLowerCase()) {
      setInviteError("You cannot invite yourself to your own group");
      setSendingInvite(false);
      return;
    }

    // For new users, we don't need to check if they exist
    // Just send them the signup link directly
    let existingProfile = null;
    const senderName = profile?.full_name || user?.email || "A parent";
    const groupName = group.name;
    const note = inviteNote.trim() ? `\n\nNote from ${senderName}: ${inviteNote.trim()}` : "";
    const subject = `Group Invitation: ${groupName}`;
    const content = `You have been invited to join the group '${groupName}' by ${senderName}.${note}`;
    const inviteId = uuidv4();
    const { error: inviteError } = await supabase
      .from("group_invites")
      .insert([
        {
          id: inviteId,
          group_id: group.id,
          email: inviteEmail.trim().toLowerCase(),
          invited_by: user?.id,
          status: "pending",
        },
      ]);
    if (inviteError) {
      setInviteError(inviteError.message);
      setSendingInvite(false);
      return;
    }
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    if (membersError) {
      setInviteError(membersError.message);
      setSendingInvite(false);
      return;
    }
    const memberIds = (groupMembers || []).map((m: any) => m.profile_id).filter(Boolean);
    if (user?.id && !memberIds.includes(user.id)) {
      memberIds.push(user.id);
    }
    if (existingProfile) {
      // User exists - send internal message
      const messageInsert = {
        group_id: group.id,
        sender_id: user?.id,
        recipient_id: existingProfile.id,
        subject,
        content,
        role: 'invite',
      };
      const { error: msgError } = await supabase
        .from("messages")
        .insert([messageInsert]);
      if (msgError) {
        setInviteError(msgError.message);
        setSendingInvite(false);
        return;
      }
      const { data: insertData, error: memberInsertError } = await supabase
        .from("group_members")
        .insert([
          {
            group_id: group.id,
            profile_id: existingProfile.id,
            role: 'parent',
            status: 'pending',
            joined_at: new Date().toISOString(),
          },
        ]);
      if (memberInsertError) {
        if (memberInsertError.code === '23505' || memberInsertError.message.includes('duplicate key')) {
          const { error: updateError } = await supabase
            .from("group_members")
            .update({ status: 'pending' })
            .eq("group_id", group.id)
            .eq("profile_id", existingProfile.id);
          if (updateError) {
            setInviteError(updateError.message);
            setSendingInvite(false);
            return;
          }
        } else {
          setInviteError(memberInsertError.message);
          setSendingInvite(false);
          return;
        }
      }
      setInviteError("");
      setInvitingGroupId(null);
      setInviteEmail("");
      setInviteNote("");
      setSendingInvite(false);
      alert("Invite sent as internal message!");
    } else {
      // User doesn't exist - send external email invitation
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const signupLink = `${appUrl}/signup?invite=${inviteId}`;
      
      const emailResult = await emailService.sendGroupInviteEmail({
        to: inviteEmail.trim().toLowerCase(),
        groupName,
        senderName,
        customNote: inviteNote.trim() || undefined,
        inviteId,
        appUrl: appUrl
      });

      if (!emailResult.success) {
        setInviteError(emailResult.error || 'Failed to send invitation email');
        setSendingInvite(false);
        return;
      }

      setInviteError("");
      setInvitingGroupId(null);
      setInviteEmail("");
      setInviteNote("");
      setSendingInvite(false);
      alert("Invitation email sent! The recipient will receive a link to create an account and join your group.");
    }
  }

  // Toggle child membership in group
  // Toggle pet membership in group
  async function handleTogglePet(pet: Pet, group: Group) {
    setGroupManagementError("");
    const membership = petMemberships.find(
      (m) => m.pet_id === pet.id && m.group_id === group.id
    );

    if (!membership) {
      // Activate pet in group
      try {
        console.log('🔄 Activating pet in group:', pet.id, group.id);

        // Use upsert to either insert new row or update existing inactive row
        const { error: upsertError } = await supabase
          .from("pet_group_members")
          .upsert({
            pet_id: pet.id,
            group_id: group.id,
            added_by: user!.id,
            active: true
          }, {
            onConflict: 'pet_id,group_id'
          });

        if (upsertError) {
          console.error('❌ Error activating pet in group:', upsertError);
          setGroupManagementError('Failed to add pet to group');
          return;
        }

        console.log('✅ Pet activated successfully');

        // Optimistically update UI - add pet to group immediately
        const newMembership: PetGroupMember = {
          id: uuidv4(),
          pet_id: pet.id,
          group_id: group.id,
          added_by: user!.id,
          added_at: new Date().toISOString(),
          active: true
        };
        setPetMemberships([...petMemberships, newMembership]);

        // Add pet to the group's pets list
        const petWithParent = { ...pet, parent_full_name: profile?.full_name || 'You' };
        setAllPetsInGroups({
          ...allPetsInGroups,
          [group.id]: [...(allPetsInGroups[group.id] || []), petWithParent]
        });

        console.log('🔄 UI updated optimistically');

      } catch (err) {
        console.error('❌ Error adding pet to group:', err);
        setGroupManagementError('Failed to add pet to group');
      }
    } else {
      // Deactivate pet in group
      try {
        console.log('🔄 Deactivating pet from group:', pet.id, group.id);

        const { error } = await supabase
          .from("pet_group_members")
          .update({ active: false })
          .eq("pet_id", pet.id)
          .eq("group_id", group.id);

        if (error) {
          console.error('❌ Error deactivating pet from group:', error);
          setGroupManagementError('Failed to remove pet from group');
          return;
        }

        console.log('✅ Pet deactivated successfully');

        // Optimistically update UI - remove pet from group immediately
        setPetMemberships(petMemberships.filter(
          m => !(m.pet_id === pet.id && m.group_id === group.id)
        ));

        // Remove pet from the group's pets list
        setAllPetsInGroups({
          ...allPetsInGroups,
          [group.id]: (allPetsInGroups[group.id] || []).filter(p => p.id !== pet.id)
        });

        console.log('🔄 UI updated optimistically');

      } catch (err) {
        console.error('❌ Error removing pet from group:', err);
        setGroupManagementError('Failed to remove pet from group');
      }
    }
  }

  async function handleToggleChild(child: Child, group: Group) {
    setGroupManagementError("");
    const membership = memberships.find(
      (m) => m.child_id === child.id && m.group_id === group.id
    );

    if (!membership) {
      // Activate child in group
      try {
        console.log('🔄 Activating child in group:', child.id, group.id);

        // First check if an inactive membership exists
        const { data: existingMembership } = await supabase
          .from("child_group_members")
          .select("*")
          .eq("child_id", child.id)
          .eq("group_id", group.id)
          .single();

        if (existingMembership) {
          // Update existing inactive membership to active
          const { error: updateError } = await supabase
            .from("child_group_members")
            .update({ active: true })
            .eq("child_id", child.id)
            .eq("group_id", group.id);

          if (updateError) {
            console.error('❌ Error reactivating child in group:', updateError);
            setGroupManagementError('Failed to add child to group');
            return;
          }
        } else {
          // Insert new membership
          const { error: insertError } = await supabase
            .from("child_group_members")
            .insert({
              child_id: child.id,
              group_id: group.id,
              added_by: user!.id,
              active: true
            });

          if (insertError) {
            console.error('❌ Error adding child to group:', insertError);
            setGroupManagementError('Failed to add child to group');
            return;
          }
        }

        console.log('✅ Child activated successfully');

        // Optimistically update UI - add child to group immediately
        const newMembership: ChildGroupMember = {
          id: uuidv4(),
          child_id: child.id,
          group_id: group.id,
          added_by: user!.id,
          added_at: new Date().toISOString(),
          active: true
        };
        setMemberships([...memberships, newMembership]);

        // Add child to the group's children list
        const childWithParent = { ...child, parent_full_name: profile?.full_name || 'You' };
        setAllChildrenInGroups({
          ...allChildrenInGroups,
          [group.id]: [...(allChildrenInGroups[group.id] || []), childWithParent]
        });

        console.log('🔄 UI updated optimistically');

      } catch (err) {
        console.error('❌ Error adding child to group:', err);
        setGroupManagementError('Failed to add child to group');
      }
    } else {
      // Deactivate child in group
      try {
        console.log('🔄 Deactivating child from group:', child.id, group.id);

        const { error } = await supabase
          .from("child_group_members")
          .update({ active: false })
          .eq("child_id", child.id)
          .eq("group_id", group.id);

        if (error) {
          console.error('❌ Error deactivating child from group:', error);
          setGroupManagementError('Failed to remove child from group');
          return;
        }

        console.log('✅ Child deactivated successfully');

        // Optimistically update UI - remove child from group immediately
        setMemberships(memberships.filter(
          m => !(m.child_id === child.id && m.group_id === group.id)
        ));

        // Remove child from the group's children list
        setAllChildrenInGroups({
          ...allChildrenInGroups,
          [group.id]: (allChildrenInGroups[group.id] || []).filter(c => c.id !== child.id)
        });

        console.log('🔄 UI updated optimistically');

      } catch (err) {
        console.error('❌ Error removing child from group:', err);
        setGroupManagementError('Failed to remove child from group');
      }
    }
  }



  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <Header currentPage="dashboard">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto bg-white">
        {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm md:text-base transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm md:text-base transition-colors whitespace-nowrap ${
            activeTab === 'groups'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Groups
        </button>
        <button
          onClick={() => setActiveTab('children')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm md:text-base transition-colors whitespace-nowrap ${
            activeTab === 'children'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Children
        </button>
        <button
          onClick={() => setActiveTab('pets')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm md:text-base transition-colors whitespace-nowrap ${
            activeTab === 'pets'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pets
        </button>

      </div>

      {/* Swipeable Content Area */}
      <div {...swipeHandlers}>
      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Profile</h2>
            {!editingProfile && (
              <button
                onClick={handleEditProfile}
                className="px-4 py-2 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition shadow-soft hover:shadow-medium"
              >
                Edit Profile
              </button>
            )}
          </div>

          {!editingProfile ? (
            <div className="space-y-4 text-sm sm:text-base">
              {/* Top Section: Photo + Basic Info */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Profile Photo on Left */}
                <div className="flex-shrink-0">
                  {profile?.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-blue-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-200 border-4 border-gray-300 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No Photo</span>
                    </div>
                  )}
                </div>

                {/* Basic Info on Right */}
                <div className="flex-1 space-y-2">
                  <div><strong>Name:</strong> {profile?.full_name || <span className="text-gray-400">(not set)</span>}</div>
                  <div><strong>Phone:</strong> {formatPhone(profile?.phone) || <span className="text-gray-400">(not set)</span>}</div>
                  <div><strong>Email:</strong> {profile?.email || user?.email || <span className="text-gray-400">(not set)</span>}</div>
                </div>
              </div>

              {/* Bio Section */}
              {profile?.bio && (
                <div className="pt-2 border-t"><strong>Bio:</strong> <p className="mt-1 text-gray-700">{profile.bio}</p></div>
              )}

              {/* Profession and Employer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div><strong>Profession:</strong> {profile?.profession || <span className="text-gray-400">(not set)</span>}</div>
                <div><strong>Employer:</strong> {profile?.employer || <span className="text-gray-400">(not set)</span>}</div>
              </div>

              {/* Address Section */}
              <div className="space-y-1 pt-2 border-t">
                <div><strong>Address:</strong></div>
                <div className="pl-4">
                  <div>{profile?.address || <span className="text-gray-400">(not set)</span>}</div>
                  <div>
                    {profile?.city || <span className="text-gray-400">(city)</span>}, {profile?.state || <span className="text-gray-400">(state)</span>} {profile?.zip_code || <span className="text-gray-400">(zip)</span>}
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div><strong>Emergency Contact:</strong> {profile?.emergency_contact || <span className="text-gray-400">(not set)</span>}</div>
                <div><strong>Emergency Phone:</strong> {formatPhone(profile?.emergency_contact_phone) || <span className="text-gray-400">(not set)</span>}</div>
              </div>

            </div>
          ) : (
            <div className="space-y-4">
              {profileEditError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {profileEditError}
                </div>
              )}

              {/* Profile Photo Upload with Preview */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Profile Photo</label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file, 'profile');
                        e.target.value = '';
                      }}
                      className="hidden"
                      disabled={uploadingProfilePhoto}
                    />
                    <div
                      className={`p-2 rounded-lg transition flex items-center gap-2 ${
                        uploadingProfilePhoto
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
                        {uploadingProfilePhoto ? 'Uploading...' : 'Choose Photo'}
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-1">Upload a photo from your camera or gallery (max 10MB, automatically compressed)</p>

                {/* Upload Status Messages */}
                {uploadingProfilePhoto && (
                  <p className="text-sm text-blue-600 mt-2">Uploading and compressing photo...</p>
                )}
                {profilePhotoError && (
                  <p className="text-sm text-red-600 mt-2">{profilePhotoError}</p>
                )}

                {/* Preview */}
                {editProfilePhotoUrl && !uploadingProfilePhoto && (
                  <div className="mt-3 flex justify-center">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-2">Preview:</p>
                      <img
                        src={editProfilePhotoUrl}
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

              {/* Basic Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(123) 456-7890"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email (Read-only)</label>
                <input
                  type="email"
                  value={profile?.email || user?.email || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>

              {/* Bio Section */}
              <div>
                <label className="block text-sm font-medium mb-1">Bio / About Me</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </div>

              {/* Profession and Employer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Profession</label>
                  <input
                    type="text"
                    value={editProfession}
                    onChange={(e) => setEditProfession(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Teacher, Engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Employer</label>
                  <input
                    type="text"
                    value={editEmployer}
                    onChange={(e) => setEditEmployer(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company name"
                  />
                </div>
              </div>

              {/* Address Section */}
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Street address"
                />
              </div>

              {/* City, State, ZIP (aligned like address) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={editZipCode}
                    onChange={(e) => handleProfileZipCodeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345"
                    maxLength={5}
                  />
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={editEmergencyContact}
                    onChange={(e) => setEditEmergencyContact(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contact name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={editEmergencyContactPhone}
                    onChange={(e) => setEditEmergencyContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(123) 456-7890"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancelProfileEdit}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Children Tab */}
      {activeTab === 'children' && (
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Children</h2>
            <button
              onClick={() => setShowAddChild(!showAddChild)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-soft hover:shadow-medium"
            >
              {showAddChild ? "Cancel" : "Add Child"}
            </button>
          </div>

          {showAddChild && (
            <form onSubmit={handleAddChild} className="mb-6 p-3 sm:p-4 bg-white rounded-lg border border-cyan-200">
              <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Add New Child</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Child's Name *</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildName(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter child's name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Birthdate *</label>
                  <input
                    type="date"
                    value={childBirthdate}
                    onChange={(e) => setChildBirthdate(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={childZipCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChildZipCodeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter zip code"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Town</label>
                  <input
                    type="text"
                    value={childTown}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildTown(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto-filled from ZIP code"
                  />
                  {childTown && <p className="text-xs text-gray-500 mt-1">Auto-populated from ZIP code</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">School Name</label>
                  {loadingSchools ? (
                    <div className="w-full px-3 py-2 border border-blue-300 rounded-lg text-gray-500">
                      Loading schools...
                    </div>
                  ) : showMissingSchoolInput ? (
                    <div>
                      <input
                        type="text"
                        value={missingSchoolName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setMissingSchoolName(e.target.value);
                          setChildSchoolName(e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter the school name not shown"
                        autoFocus
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        We'll notify the admin to add this school to the database.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMissingSchoolInput(false);
                          setMissingSchoolName("");
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                      >
                        Back to school list
                      </button>
                    </div>
                  ) : availableSchools.length > 0 ? (
                    <select
                      value={childSchoolName}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const value = e.target.value;
                        if (value === "__missing__") {
                          setShowMissingSchoolInput(true);
                          setChildSchoolName("");
                        } else if (value === "__custom__") {
                          setChildSchoolName("");
                          // Show manual input without notification
                        } else {
                          setChildSchoolName(value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a school</option>
                      {availableSchools.map((school) => (
                        <option key={school.id} value={school.name}>
                          {school.name}
                        </option>
                      ))}
                      <option value="__missing__">🔔 School not shown (notify admin)</option>
                      <option value="__custom__">✏️ Other (type manually)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={childSchoolName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildSchoolName(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter school name or ZIP code first"
                    />
                  )}
                  {childSchoolName === "__custom__" && !showMissingSchoolInput && (
                    <input
                      type="text"
                      value=""
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildSchoolName(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                      placeholder="Enter school name"
                      autoFocus
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Grade</label>
                  <input
                    type="text"
                    value={childGrade}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChildGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter grade (e.g., 4, K, 12)"
                  />
                </div>
              </div>
              {childError && <div className="text-red-600 mb-4">{childError}</div>}
              <button
                type="submit"
                disabled={addingChild}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-soft hover:shadow-medium"
              >
                {addingChild ? "Adding..." : "Add Child"}
              </button>
            </form>
          )}

          {children.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No children added yet.</p>
              <p className="text-sm">Click "Add Child" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child) => {
                const age = calculateAge(child.birthdate);
                return (
                  <div key={child.id} className="border border-cyan-200 rounded-lg p-4 flex flex-col gap-2 bg-white">
                    {editingChildId === child.id ? (
                      <>
                        {/* Photo Upload Section */}
                        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block font-medium">Child Photo (Optional)</label>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileSelect(file, 'child');
                                  e.target.value = '';
                                }}
                                className="hidden"
                                disabled={uploadingChildPhoto}
                              />
                              <div
                                className={`p-2 rounded-lg transition flex items-center gap-2 ${
                                  uploadingChildPhoto
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
                                  {uploadingChildPhoto ? 'Uploading...' : 'Choose Photo'}
                                </span>
                              </div>
                            </label>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Upload a photo from your camera or gallery (max 10MB, automatically compressed)</p>

                          {/* Upload Status Messages */}
                          {uploadingChildPhoto && (
                            <p className="text-sm text-blue-600 mt-2">Uploading and compressing photo...</p>
                          )}
                          {childPhotoError && (
                            <p className="text-sm text-red-600 mt-2">{childPhotoError}</p>
                          )}

                          {/* Preview */}
                          {editChildPhotoUrl && !uploadingChildPhoto && (
                            <div className="mt-3 flex justify-center">
                              <div className="text-center">
                                <p className="text-xs text-gray-600 mb-2">Preview:</p>
                                <img
                                  src={editChildPhotoUrl}
                                  alt="Child Preview"
                                  className="w-24 h-24 rounded-full object-cover border-4 border-blue-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Child's Name *</label>
                            <input
                              type="text"
                              value={editChildName}
                              onChange={(e) => setEditChildName(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="Child's name"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Birthdate *</label>
                            <input
                              type="date"
                              value={editChildBirthdate}
                              onChange={(e) => setEditChildBirthdate(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              max={new Date().toISOString().split('T')[0]}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Zip Code</label>
                            <input
                              type="text"
                              value={editChildZipCode}
                              onChange={(e) => handleEditChildZipCodeChange(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="Zip code"
                              maxLength={5}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Town</label>
                            <input
                              type="text"
                              value={editChildTown}
                              onChange={(e) => setEditChildTown(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="Auto-filled from ZIP code"
                            />
                            {editChildTown && <p className="text-xs text-gray-500 mt-1">Auto-populated from ZIP code</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">School Name</label>
                            {editLoadingSchools ? (
                              <div className="w-full px-3 py-2 border rounded text-gray-500">
                                Loading schools...
                              </div>
                            ) : editAvailableSchools.length > 0 ? (
                              <select
                                value={editChildSchoolName}
                                onChange={(e) => setEditChildSchoolName(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                              >
                                <option value="">Select a school</option>
                                {editAvailableSchools.map((school) => (
                                  <option key={school.id} value={school.name}>
                                    {school.name}
                                  </option>
                                ))}
                                <option value="__custom__">Other (type manually)</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={editChildSchoolName}
                                onChange={(e) => setEditChildSchoolName(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Enter school name or ZIP code first"
                              />
                            )}
                            {editChildSchoolName === "__custom__" && (
                              <input
                                type="text"
                                value=""
                                onChange={(e) => setEditChildSchoolName(e.target.value)}
                                className="w-full px-3 py-2 border rounded mt-2"
                                placeholder="Enter school name"
                                autoFocus
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Grade</label>
                            <input
                              type="text"
                              value={editChildGrade}
                              onChange={(e) => setEditChildGrade(e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              placeholder="Grade"
                            />
                          </div>
                        </div>
                        {childEditError && <div className="text-red-600 mt-2">{childEditError}</div>}
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleSaveChildEdit(child)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelChildEdit}
                            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Top section with Edit button */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-lg">{child.full_name}</span>
                          <button
                            onClick={() => handleEditChild(child)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Edit
                          </button>
                        </div>

                        {/* Photo + Basic Info Layout */}
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Profile Photo on Left */}
                          <div className="flex-shrink-0">
                            {child.photo_url ? (
                              <img
                                src={child.photo_url}
                                alt={child.full_name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-blue-200"
                                onError={(e) => {
                                  // Fallback to gradient placeholder if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 border-4 border-blue-200 flex items-center justify-center"
                              style={{ display: child.photo_url ? 'none' : 'flex' }}
                            >
                              <span className="text-white text-2xl font-bold">
                                {child.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Basic Info on Right */}
                          <div className="flex-1 space-y-2 text-sm">
                            <div><strong>Name:</strong> {child.full_name}</div>
                            <div><strong>Birthday:</strong> {formatBirthdate(child.birthdate)}</div>
                            <div><strong>Age:</strong> {age !== null ? `${age} years old` : "Unknown"}</div>
                          </div>
                        </div>

                        {/* School and Grade */}
                        {(child.school_name || child.grade) && (
                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                            <div>
                              <strong className="text-sm">School:</strong>
                              <div className="text-gray-700">{child.school_name || <span className="text-gray-400">(not set)</span>}</div>
                            </div>
                            <div>
                              <strong className="text-sm">Grade:</strong>
                              <div className="text-gray-700">{child.grade || <span className="text-gray-400">(not set)</span>}</div>
                            </div>
                          </div>
                        )}

                        {/* Town and Zip Code */}
                        {(child.town || child.zip_code) && (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <strong className="text-sm">Town:</strong>
                              <div className="text-gray-700">{child.town || <span className="text-gray-400">(not set)</span>}</div>
                            </div>
                            <div>
                              <strong className="text-sm">Zip Code:</strong>
                              <div className="text-gray-700">{child.zip_code || <span className="text-gray-400">(not set)</span>}</div>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-3 pt-2 border-t">
                          Added: {new Date(child.created_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pets Tab */}
      {activeTab === 'pets' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Pets</h2>
            <button
              onClick={() => setShowAddPet(!showAddPet)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-soft hover:shadow-medium"
            >
              {showAddPet ? "Cancel" : "Add Pet"}
            </button>
          </div>

          {showAddPet && (
            <form onSubmit={handleAddPet} className="mb-6 p-4 bg-white rounded-lg border border-purple-200">
              <h3 className="text-base sm:text-lg font-medium mb-4">Add New Pet</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Pet's Name</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter pet's name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Species</label>
                  <input
                    type="text"
                    value={petSpecies}
                    onChange={(e) => setPetSpecies(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., Dog, Cat, Bird"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Breed</label>
                  <input
                    type="text"
                    value={petBreed}
                    onChange={(e) => setPetBreed(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter breed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age (years)</label>
                  <input
                    type="number"
                    value={petAge}
                    onChange={(e) => setPetAge(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter age"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Birthdate</label>
                  <input
                    type="date"
                    value={petBirthdate}
                    onChange={(e) => setPetBirthdate(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Special Needs</label>
                  <input
                    type="text"
                    value={petSpecialNeeds}
                    onChange={(e) => setPetSpecialNeeds(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Any special care requirements"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={petNotes}
                    onChange={(e) => setPetNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Additional information about your pet"
                    rows={3}
                  />
                </div>
              </div>
              {petError && <div className="text-red-600 mb-4">{petError}</div>}
              <button
                type="submit"
                disabled={addingPet}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 shadow-soft hover:shadow-medium"
              >
                {addingPet ? "Adding..." : "Add Pet"}
              </button>
            </form>
          )}

          {pets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pets added yet.</p>
              <p className="text-sm">Click "Add Pet" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pets.map((pet) => (
                <div key={pet.id} className="border border-purple-200 rounded-lg p-4 flex flex-col gap-2 bg-white">
                  {editingPetId === pet.id ? (
                    <>
                      {/* Photo Upload Section */}
                      <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block font-medium">Pet Photo (Optional)</label>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file, 'pet');
                                e.target.value = '';
                              }}
                              className="hidden"
                              disabled={uploadingPetPhoto}
                            />
                            <div
                              className={`p-2 rounded-lg transition flex items-center gap-2 ${
                                uploadingPetPhoto
                                  ? 'bg-gray-200 cursor-not-allowed'
                                  : 'bg-purple-500 hover:bg-purple-600'
                              }`}
                              title="Upload Photo from Camera/Gallery"
                            >
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-white text-sm font-medium">
                                {uploadingPetPhoto ? 'Uploading...' : 'Choose Photo'}
                              </span>
                            </div>
                          </label>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Upload a photo from your camera or gallery (max 10MB, automatically compressed)</p>

                        {/* Upload Status Messages */}
                        {uploadingPetPhoto && (
                          <p className="text-sm text-purple-600 mt-2">Uploading and compressing photo...</p>
                        )}
                        {petPhotoError && (
                          <p className="text-sm text-red-600 mt-2">{petPhotoError}</p>
                        )}

                        {/* Preview */}
                        {editPetPhotoUrl && !uploadingPetPhoto && (
                          <div className="mt-3 flex justify-center">
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-2">Preview:</p>
                              <img
                                src={editPetPhotoUrl}
                                alt="Pet Preview"
                                className="w-24 h-24 rounded-full object-cover border-4 border-purple-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={editPetName}
                          onChange={(e) => setEditPetName(e.target.value)}
                          className="px-3 py-2 border rounded"
                          placeholder="Pet's name"
                          required
                        />
                        <input
                          type="text"
                          value={editPetSpecies}
                          onChange={(e) => setEditPetSpecies(e.target.value)}
                          className="px-3 py-2 border rounded"
                          placeholder="Species"
                        />
                        <input
                          type="text"
                          value={editPetBreed}
                          onChange={(e) => setEditPetBreed(e.target.value)}
                          className="px-3 py-2 border rounded"
                          placeholder="Breed"
                        />
                        <input
                          type="number"
                          value={editPetAge}
                          onChange={(e) => setEditPetAge(e.target.value)}
                          className="px-3 py-2 border rounded"
                          placeholder="Age"
                          min="0"
                        />
                        <input
                          type="date"
                          value={editPetBirthdate}
                          onChange={(e) => setEditPetBirthdate(e.target.value)}
                          className="px-3 py-2 border rounded"
                          max={new Date().toISOString().split('T')[0]}
                        />
                        <input
                          type="text"
                          value={editPetSpecialNeeds}
                          onChange={(e) => setEditPetSpecialNeeds(e.target.value)}
                          className="px-3 py-2 border rounded"
                          placeholder="Special needs"
                        />
                      </div>
                      <textarea
                        value={editPetNotes}
                        onChange={(e) => setEditPetNotes(e.target.value)}
                        className="px-3 py-2 border rounded"
                        placeholder="Notes"
                        rows={2}
                      />
                      {petEditError && <div className="text-red-600 mb-2">{petEditError}</div>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSavePetEdit(pet)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelPetEdit}
                          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Top section with Edit button */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-lg">{pet.name}</span>
                        <button
                          onClick={() => handleEditPet(pet)}
                          className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Photo + Basic Info Layout */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Profile Photo on Left */}
                        <div className="flex-shrink-0">
                          {pet.photo_url ? (
                            <img
                              src={pet.photo_url}
                              alt={pet.name}
                              className="w-24 h-24 rounded-full object-cover border-4 border-purple-200"
                              onError={(e) => {
                                // Fallback to gradient placeholder if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-4 border-purple-200 flex items-center justify-center"
                            style={{ display: pet.photo_url ? 'none' : 'flex' }}
                          >
                            <span className="text-white text-2xl font-bold">
                              {pet.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Basic Info on Right */}
                        <div className="flex-1 space-y-2 text-sm">
                          <div><strong>Name:</strong> {pet.name}</div>
                          <div><strong>Species:</strong> {pet.species || <span className="text-gray-400">(not set)</span>}</div>
                          <div><strong>Breed:</strong> {pet.breed || <span className="text-gray-400">(not set)</span>}</div>
                        </div>
                      </div>

                      {/* Age and Birthday */}
                      {(pet.age !== null || pet.birthdate) && (
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                          <div>
                            <strong className="text-sm">Age:</strong>
                            <div className="text-gray-700">{pet.age !== null ? `${pet.age} years old` : <span className="text-gray-400">(not set)</span>}</div>
                          </div>
                          <div>
                            <strong className="text-sm">Birthday:</strong>
                            <div className="text-gray-700">{pet.birthdate ? formatBirthdate(pet.birthdate) : <span className="text-gray-400">(not set)</span>}</div>
                          </div>
                        </div>
                      )}

                      {/* Special Needs */}
                      {pet.special_needs && (
                        <div className="mt-3 pt-3 border-t">
                          <strong className="text-sm">Special Needs:</strong>
                          <div className="text-gray-700 mt-1">{pet.special_needs}</div>
                        </div>
                      )}

                      {/* Notes */}
                      {pet.notes && (
                        <div className="mt-2">
                          <strong className="text-sm">Notes:</strong>
                          <div className="text-gray-700 mt-1">{pet.notes}</div>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mt-3 pt-2 border-t">
                        Added: {new Date(pet.created_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Group Management Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Groups</h2>
              <button
                onClick={() => setShowAddGroup(!showAddGroup)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-soft hover:shadow-medium"
              >
                {showAddGroup ? "Cancel" : "Add Group"}
              </button>
            </div>
            {groupManagementError && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{groupManagementError}</div>}

            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No groups available.</p>
                <p className="text-sm">Create a group first to manage memberships.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Children Groups Section */}
                {groups.filter(g => g.group_type !== 'pet').length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-medium mb-4 text-blue-800 flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 rounded">Children Groups</span>
                    </h3>
                    <div className="space-y-6">
                      {groups.filter(g => g.group_type !== 'pet').map((group) => {
                        const allChildrenInGroup = allChildrenInGroups[group.id] || [];
                        const allPetsInGroup = allPetsInGroups[group.id] || [];
                        const isCreator = isGroupCreator(group);
                        const isPetGroup = false;

                        return (
                          <div key={group.id} className="border border-cyan-200 rounded p-6 bg-white">
                            <div className="mb-3">
                              <h4 className="text-lg font-semibold mb-2">{group.name}</h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditGroup(group)}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleInviteGroup(group)}
                                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  Invite
                                </button>
                              </div>
                            </div>

                      {/* Edit Group Form */}
                      {editingGroupId === group.id ? (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h4 className="font-medium mb-3">Edit Group</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Group Type</label>
                              <select
                                value={editGroupType}
                                onChange={(e) => setEditGroupType(e.target.value as 'care' | 'pet')}
                                className="w-full px-3 py-2 border rounded"
                              >
                                <option value="care">Care Group (For child care)</option>
                                <option value="pet">Pet Group (For pet care)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Group Name</label>
                              <input
                                type="text"
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Group name"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Description</label>
                              <textarea
                                value={editGroupDescription}
                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Group description"
                                rows={2}
                              />
                            </div>
                            {groupEditError && <div className="text-red-600 text-sm">{groupEditError}</div>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveGroupEdit(group)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelGroupEdit}
                                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
                        </>
                      )}

                      {/* Invite Form */}
                      {invitingGroupId === group.id && (
                        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="font-medium mb-3">Invite Parent to Group</h4>
                          <form onSubmit={(e) => handleSubmitInvite(e, group)} className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Parent Email</label>
                              <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="parent@example.com"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Note (Optional)</label>
                              <textarea
                                value={inviteNote}
                                onChange={(e) => setInviteNote(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Add a personal note..."
                                rows={2}
                              />
                            </div>
                            {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={sendingInvite}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                              >
                                {sendingInvite ? 'Sending...' : 'Send Invite'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInvite}
                                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Show Children for Care Groups */}
                      {!isPetGroup && (
                        <>
                          {/* All Children in Group */}
                          <div className="mb-6">
                            <h4 className="font-medium mb-3">All Children in this Group:</h4>
                            {allChildrenInGroup.length === 0 ? (
                              <div className="text-gray-500">No children are currently in this group.</div>
                            ) : (
                              <div className="space-y-2">
                                {allChildrenInGroup.map((child) => {
                                  const isMyChild = child.parent_id === user?.id;
                                  return (
                                    <div key={child.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                      isMyChild ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                                    }`}>
                                      <div className="flex items-center">
                                        <span className="font-medium">{child.full_name}</span>
                                        {child.birthdate && (
                                          <span className="text-sm text-gray-500 ml-2">
                                            ({Math.floor((new Date().getTime() - new Date(child.birthdate).getTime()) / (1000 * 60 * 60 * 24 * 365))})
                                          </span>
                                        )}
                                        {isMyChild && (
                                          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">You</span>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        Parent: {child.parent_full_name || 'Unknown'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Your Children */}
                          {children.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">Add/Remove Your Children:</h4>
                              <div className="space-y-2">
                                {children.map((child) => {
                                  const isMember = allChildrenInGroup.some(c => c.id === child.id);
                                  return (
                                    <div key={child.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                                      <div className="flex items-center">
                                        <span className="font-medium">{child.full_name}</span>
                                        {child.birthdate && (
                                          <span className="text-sm text-gray-500 ml-2">
                                            ({calculateAge(child.birthdate)})
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleToggleChild(child, group)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                          isMember
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                      >
                                        {isMember ? 'Remove' : 'Add'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {children.length === 0 && (
                            <div className="text-gray-500">
                              No children added yet. Add children from the Children tab first.
                            </div>
                          )}
                        </>
                      )}

                      {/* Show Pets for Pet Groups */}
                      {isPetGroup && (
                        <>
                          {/* All Pets in Group */}
                          <div className="mb-6">
                            <h4 className="font-medium mb-3">All Pets in this Group:</h4>
                            {allPetsInGroup.length === 0 ? (
                              <div className="text-gray-500">No pets are currently in this group.</div>
                            ) : (
                              <div className="space-y-2">
                                {allPetsInGroup.map((pet) => {
                                  const isMyPet = pet.parent_id === user?.id;
                                  return (
                                    <div key={pet.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                      isMyPet ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'
                                    }`}>
                                      <div className="flex items-center">
                                        <span className="font-medium">{pet.name}</span>
                                        {pet.species && (
                                          <span className="text-sm text-gray-500 ml-2">({pet.species})</span>
                                        )}
                                        {isMyPet && (
                                          <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">You</span>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        Owner: {pet.parent_full_name || 'Unknown'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Your Pets */}
                          {pets.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">Add/Remove Your Pets:</h4>
                              <div className="space-y-2">
                                {pets.map((pet) => {
                                  const isMember = allPetsInGroup.some(p => p.id === pet.id);
                                  return (
                                    <div key={pet.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                                      <div className="flex items-center">
                                        <span className="font-medium">{pet.name}</span>
                                        {pet.species && (
                                          <span className="text-sm text-gray-500 ml-2">({pet.species})</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleTogglePet(pet, group)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                          isMember
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                      >
                                        {isMember ? 'Remove' : 'Add'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {pets.length === 0 && (
                            <div className="text-gray-500">
                              No pets added yet. Add pets from the Pets tab first.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                    </div>
                  </div>
                )}

                {/* Pet Groups Section */}
                {groups.filter(g => g.group_type === 'pet').length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-medium mb-4 text-purple-800 flex items-center gap-2">
                      <span className="px-3 py-1 bg-purple-100 rounded">Pet Groups</span>
                    </h3>
                    <div className="space-y-6">
                      {groups.filter(g => g.group_type === 'pet').map((group) => {
                        const allChildrenInGroup = allChildrenInGroups[group.id] || [];
                        const allPetsInGroup = allPetsInGroups[group.id] || [];
                        const isCreator = isGroupCreator(group);
                        const isPetGroup = true;

                        return (
                          <div key={group.id} className="border border-purple-200 rounded p-6 bg-white">
                            <div className="mb-3">
                              <h4 className="text-lg font-semibold mb-2">{group.name}</h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditGroup(group)}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleInviteGroup(group)}
                                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  Invite
                                </button>
                              </div>
                            </div>

                      {/* Edit Group Form */}
                      {editingGroupId === group.id ? (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h4 className="font-medium mb-3">Edit Group</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Group Type</label>
                              <select
                                value={editGroupType}
                                onChange={(e) => setEditGroupType(e.target.value as 'care' | 'pet')}
                                className="w-full px-3 py-2 border rounded"
                              >
                                <option value="care">Care Group (For child care)</option>
                                <option value="pet">Pet Group (For pet care)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Group Name</label>
                              <input
                                type="text"
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Group name"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Description</label>
                              <textarea
                                value={editGroupDescription}
                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Group description"
                                rows={2}
                              />
                            </div>
                            {groupEditError && <div className="text-red-600 text-sm">{groupEditError}</div>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveGroupEdit(group)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelGroupEdit}
                                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
                        </>
                      )}

                      {/* Invite Form */}
                      {invitingGroupId === group.id && (
                        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="font-medium mb-3">Invite Parent to Group</h4>
                          <form onSubmit={(e) => handleSubmitInvite(e, group)} className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Parent Email</label>
                              <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="parent@example.com"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Note (Optional)</label>
                              <textarea
                                value={inviteNote}
                                onChange={(e) => setInviteNote(e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                                placeholder="Add a personal note..."
                                rows={2}
                              />
                            </div>
                            {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={sendingInvite}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                              >
                                {sendingInvite ? 'Sending...' : 'Send Invite'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInvite}
                                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Show Pets for Pet Groups */}
                      {isPetGroup && (
                        <>
                          {/* All Pets in Group */}
                          <div className="mb-6">
                            <h4 className="font-medium mb-3">All Pets in this Group:</h4>
                            {allPetsInGroup.length === 0 ? (
                              <div className="text-gray-500">No pets are currently in this group.</div>
                            ) : (
                              <div className="space-y-2">
                                {allPetsInGroup.map((pet) => {
                                  const isMyPet = pet.parent_id === user?.id;
                                  return (
                                    <div key={pet.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                      isMyPet ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'
                                    }`}>
                                      <div className="flex items-center">
                                        <span className="font-medium">{pet.name}</span>
                                        {pet.species && (
                                          <span className="text-sm text-gray-500 ml-2">({pet.species})</span>
                                        )}
                                        {isMyPet && (
                                          <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">You</span>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        Owner: {pet.parent_full_name || 'Unknown'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Your Pets */}
                          {pets.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">Add/Remove Your Pets:</h4>
                              <div className="space-y-2">
                                {pets.map((pet) => {
                                  const isMember = allPetsInGroup.some(p => p.id === pet.id);
                                  return (
                                    <div key={pet.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                                      <div className="flex items-center">
                                        <span className="font-medium">{pet.name}</span>
                                        {pet.species && (
                                          <span className="text-sm text-gray-500 ml-2">({pet.species})</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleTogglePet(pet, group)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                          isMember
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                      >
                                        {isMember ? 'Remove' : 'Add'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {pets.length === 0 && (
                            <div className="text-gray-500">
                              No pets added yet. Add pets from the Pets tab first.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Group Form */}
            {showAddGroup && (
              <form onSubmit={handleAddGroup} className="p-4 bg-white rounded-lg border border-cyan-200">
                <h3 className="text-base sm:text-lg font-medium mb-4">Create New Group</h3>
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Type</label>
                    <select
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value as 'care' | 'pet')}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="care">Care Group (For child care)</option>
                      <option value="pet">Pet Group (For pet care)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter group name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                    <textarea
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter group description"
                      rows={3}
                    />
                  </div>
                </div>
                {groupError && <div className="text-red-600 mb-4">{groupError}</div>}
                <button
                  type="submit"
                  disabled={addingGroup}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {addingGroup ? "Creating..." : "Create Group"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </div>

    {/* Care Data Popup */}
    {showPopup && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{popupTitle}</h2>
            <button
              onClick={() => setShowPopup(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {popupContent}
        </div>
      </div>
    )}

    {/* Success Message */}
    {rescheduleSuccessMessage && (
      <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
        {rescheduleSuccessMessage}
      </div>
    )}

    {/* Reschedule Modal */}
    {showRescheduleModal && selectedCareBlock && (
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedCareBlock(null);
        }}
        careBlock={{
          id: selectedCareBlock.id,
          group_id: selectedCareBlock.group_id,
          care_date: selectedCareBlock.date,
          start_time: selectedCareBlock.start_time,
          end_time: selectedCareBlock.end_time,
          related_request_id: selectedCareBlock.related_request_id,
          group_name: selectedCareBlock.group_name,
          children: selectedCareBlock.children
        }}
        onRescheduleSuccess={handleRescheduleSuccess}
      />
    )}

    {/* Image Crop Modal */}
    {imageToCrop && (
      <ImageCropModal
        image={imageToCrop}
        onCropComplete={handleCroppedImage}
        onCancel={handleCancelCrop}
        aspectRatio={1}
        circularCrop={true}
      />
    )}
  </Header>
);
}
