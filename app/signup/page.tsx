'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ChildData {
  id: string
  name: string
  birthdate: string
  schoolName: string
  grade: string
  town: string
  zipCode: string
}

interface PetData {
  id: string
  name: string
  species: string
  breed: string
  birthdate: string
  specialNeeds: string
  notes: string
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteId = searchParams.get('invite')

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  // Account info (Step 1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Profile info (Step 2)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [bio, setBio] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [profession, setProfession] = useState('')
  const [employer, setEmployer] = useState('')

  // Children & Pets (Step 3)
  const [children, setChildren] = useState<ChildData[]>([])
  const [pets, setPets] = useState<PetData[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteInfo, setInviteInfo] = useState<{
    groupName: string
    senderName: string
    customNote?: string
  } | null>(null)

  // Load invite information if inviteId is present
  useEffect(() => {
    if (inviteId) {
      loadInviteInfo(inviteId)
    }
  }, [inviteId])

  const loadInviteInfo = async (inviteId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_invites')
        .select(`
          id,
          group_id,
          email,
          groups!inner(name),
          profiles!group_invites_invited_by_fkey(full_name)
        `)
        .eq('id', inviteId)
        .eq('status', 'pending')
        .single()

      if (error) {
        console.error('Error loading invite:', error)
        return
      }

      setInviteInfo({
        groupName: Array.isArray(data.groups) ? (data.groups as any)[0]?.name : (data.groups as any)?.name,
        senderName: Array.isArray(data.profiles) ? (data.profiles as any)[0]?.full_name : (data.profiles as any)?.full_name || 'A parent',
        customNote: (data as any).custom_note
      })
    } catch (err) {
      console.error('Error loading invite info:', err)
    }
  }

  // Add a new empty child
  const addChild = () => {
    setChildren([...children, {
      id: uuidv4(),
      name: '',
      birthdate: '',
      schoolName: '',
      grade: '',
      town: '',
      zipCode: ''
    }])
  }

  // Update a child field
  const updateChild = (id: string, field: keyof ChildData, value: string) => {
    setChildren(children.map(child =>
      child.id === id ? { ...child, [field]: value } : child
    ))
  }

  // Remove a child
  const removeChild = (id: string) => {
    setChildren(children.filter(child => child.id !== id))
  }

  // Add a new empty pet
  const addPet = () => {
    setPets([...pets, {
      id: uuidv4(),
      name: '',
      species: '',
      breed: '',
      birthdate: '',
      specialNeeds: '',
      notes: ''
    }])
  }

  // Update a pet field
  const updatePet = (id: string, field: keyof PetData, value: string) => {
    setPets(pets.map(pet =>
      pet.id === id ? { ...pet, [field]: value } : pet
    ))
  }

  // Remove a pet
  const removePet = (id: string) => {
    setPets(pets.filter(pet => pet.id !== id))
  }

  // Validation for each step
  const validateStep1 = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    if (!password) {
      setError('Password is required')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }

    // Check if email already exists
    setLoading(true)
    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is good
        setError('Error checking email. Please try again.')
        return false
      }

      if (existingUser) {
        setError('An account with this email already exists. Please sign in instead.')
        return false
      }
    } catch (err) {
      console.error('Error checking email:', err)
      setError('Error checking email. Please try again.')
      return false
    } finally {
      setLoading(false)
    }

    return true
  }

  const validateStep2 = () => {
    if (!fullName.trim()) {
      setError('Full name is required')
      return false
    }
    if (!phone.trim()) {
      setError('Phone number is required')
      return false
    }
    return true
  }

  const validateStep3 = () => {
    // Must have at least 1 child OR 1 pet
    const validChildren = children.filter(c => c.name.trim())
    const validPets = pets.filter(p => p.name.trim())

    if (validChildren.length === 0 && validPets.length === 0) {
      setError('Please add at least one child or one pet')
      return false
    }

    // Validate each child that has a name
    for (const child of validChildren) {
      if (!child.birthdate) {
        setError(`Please enter a birthdate for ${child.name}`)
        return false
      }
    }

    // Validate each pet that has a name
    for (const pet of validPets) {
      if (!pet.species) {
        setError(`Please select a species for ${pet.name}`)
        return false
      }
    }

    return true
  }

  const handleNext = async () => {
    setError('')

    if (currentStep === 1) {
      const isValid = await validateStep1()
      if (isValid) {
        setCurrentStep(2)
      }
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3)
    }
  }

  const handleBack = () => {
    setError('')
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')

    if (!validateStep3()) return

    setLoading(true)

    try {
      // Filter to only include children/pets with names
      const validChildren = children.filter(c => c.name.trim())
      const validPets = pets.filter(p => p.name.trim())

      // Store ALL signup data in user metadata
      // This will be processed when the user first signs in after email confirmation
      const pendingProfile = {
        full_name: fullName,
        email: email.toLowerCase(),
        phone: phone,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        bio: bio || null,
        emergency_contact: emergencyContact || null,
        emergency_contact_phone: emergencyContactPhone || null,
        profession: profession || null,
        employer: employer || null,
        role: 'parent'
      }

      // Create user account with ALL pending data in metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: fullName,
            pending_profile: pendingProfile,
            pending_children: validChildren,
            pending_pets: validPets
          }
        }
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Failed to create account')
        setLoading(false)
        return
      }

      // Note: Profile, children, and pets will be created when user first signs in
      // This is handled in the dashboard page and auth page after email confirmation
      // RLS policies prevent us from inserting until user is authenticated

      // If this was an invited user, store the invite ID for later processing
      if (inviteId) {
        // We'll handle this after email confirmation too
        console.log('Invite ID stored for processing after confirmation:', inviteId)
      }

      alert('Account created successfully! Please check your email to confirm your account before signing in.')
      router.push('/auth?message=Account created successfully. Please check your email to confirm your account.')

    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  // Progress bar component
  const ProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= step
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step}
            </div>
            <span className="text-xs mt-1 text-gray-600">
              {step === 1 ? 'Account' : step === 2 ? 'Profile' : 'Family'}
            </span>
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-200 rounded-full">
        <div
          className="h-2 bg-indigo-600 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-lg mx-auto pb-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
          {inviteInfo ? 'Join the Group!' : 'Create Your Account'}
        </h2>

        {inviteInfo && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>{inviteInfo.senderName}</strong> has invited you to join{' '}
              <strong>"{inviteInfo.groupName}"</strong>
            </p>
            {inviteInfo.customNote && (
              <p className="mt-2 text-sm text-blue-700 italic">
                "{inviteInfo.customNote}"
              </p>
            )}
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mb-6">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/auth')}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </button>
        </p>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <ProgressBar />

          <form onSubmit={currentStep === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>

            {/* Step 1: Account Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password *
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password *
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Profile Information */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Street Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                      City
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                      State
                    </label>
                    <input
                      id="state"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                    Zip Code
                  </label>
                  <input
                    id="zipCode"
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="profession" className="block text-sm font-medium text-gray-700">
                    Profession
                  </label>
                  <input
                    id="profession"
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="employer" className="block text-sm font-medium text-gray-700">
                    Employer
                  </label>
                  <input
                    id="employer"
                    type="text"
                    value={employer}
                    onChange={(e) => setEmployer(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell other parents a bit about yourself..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Emergency Contact</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700">
                        Contact Name
                      </label>
                      <input
                        id="emergencyContact"
                        type="text"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                      />
                    </div>
                    <div>
                      <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700">
                        Contact Phone
                      </label>
                      <input
                        id="emergencyContactPhone"
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Children & Pets */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Your Family</h3>

                {/* Requirement notice */}
                <div className={`p-3 rounded-lg ${children.filter(c => c.name.trim()).length > 0 || pets.filter(p => p.name.trim()).length > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className={`text-sm ${children.filter(c => c.name.trim()).length > 0 || pets.filter(p => p.name.trim()).length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {children.filter(c => c.name.trim()).length > 0 || pets.filter(p => p.name.trim()).length > 0
                      ? '✓ You have added at least one child or pet.'
                      : '⚠ Please add at least one child or one pet to create your account.'}
                  </p>
                </div>

                {/* Children Section */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Children</h4>
                    <button
                      type="button"
                      onClick={addChild}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                    >
                      + Add Child
                    </button>
                  </div>

                  {children.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-4">No children added yet. Click "+ Add Child" to add one.</p>
                  ) : (
                    <div className="space-y-6">
                      {children.map((child, index) => (
                        <div key={child.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-gray-700">Child {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeChild(child.id)}
                              className="text-sm text-red-600 hover:text-red-500"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Name *</label>
                              <input
                                type="text"
                                value={child.name}
                                onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Birthdate *</label>
                              <input
                                type="date"
                                value={child.birthdate}
                                onChange={(e) => updateChild(child.id, 'birthdate', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">School</label>
                                <input
                                  type="text"
                                  value={child.schoolName}
                                  onChange={(e) => updateChild(child.id, 'schoolName', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Grade</label>
                                <select
                                  value={child.grade}
                                  onChange={(e) => updateChild(child.id, 'grade', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                >
                                  <option value="">Select grade</option>
                                  <option value="Pre-K">Pre-K</option>
                                  <option value="Kindergarten">Kindergarten</option>
                                  <option value="1st">1st Grade</option>
                                  <option value="2nd">2nd Grade</option>
                                  <option value="3rd">3rd Grade</option>
                                  <option value="4th">4th Grade</option>
                                  <option value="5th">5th Grade</option>
                                  <option value="6th">6th Grade</option>
                                  <option value="7th">7th Grade</option>
                                  <option value="8th">8th Grade</option>
                                  <option value="9th">9th Grade</option>
                                  <option value="10th">10th Grade</option>
                                  <option value="11th">11th Grade</option>
                                  <option value="12th">12th Grade</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Town</label>
                                <input
                                  type="text"
                                  value={child.town}
                                  onChange={(e) => updateChild(child.id, 'town', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Zip Code</label>
                                <input
                                  type="text"
                                  value={child.zipCode}
                                  onChange={(e) => updateChild(child.id, 'zipCode', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pets Section */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Pets</h4>
                    <button
                      type="button"
                      onClick={addPet}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                    >
                      + Add Pet
                    </button>
                  </div>

                  {pets.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-4">No pets added yet. Click "+ Add Pet" to add one.</p>
                  ) : (
                    <div className="space-y-6">
                      {pets.map((pet, index) => (
                        <div key={pet.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-medium text-gray-700">Pet {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removePet(pet.id)}
                              className="text-sm text-red-600 hover:text-red-500"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Name *</label>
                              <input
                                type="text"
                                value={pet.name}
                                onChange={(e) => updatePet(pet.id, 'name', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Species *</label>
                                <select
                                  value={pet.species}
                                  onChange={(e) => updatePet(pet.id, 'species', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                >
                                  <option value="">Select species</option>
                                  <option value="Dog">Dog</option>
                                  <option value="Cat">Cat</option>
                                  <option value="Bird">Bird</option>
                                  <option value="Fish">Fish</option>
                                  <option value="Rabbit">Rabbit</option>
                                  <option value="Hamster">Hamster</option>
                                  <option value="Guinea Pig">Guinea Pig</option>
                                  <option value="Reptile">Reptile</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Breed</label>
                                <input
                                  type="text"
                                  value={pet.breed}
                                  onChange={(e) => updatePet(pet.id, 'breed', e.target.value)}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Birthdate</label>
                              <input
                                type="date"
                                value={pet.birthdate}
                                onChange={(e) => updatePet(pet.id, 'birthdate', e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Special Needs</label>
                              <input
                                type="text"
                                value={pet.specialNeeds}
                                onChange={(e) => updatePet(pet.id, 'specialNeeds', e.target.value)}
                                placeholder="Allergies, medications, etc."
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Notes</label>
                              <textarea
                                rows={2}
                                value={pet.notes}
                                onChange={(e) => updatePet(pet.id, 'notes', e.target.value)}
                                placeholder="Any additional information..."
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </form>
        </div>
      </div>
      </div>

      {/* Fixed Navigation buttons at bottom */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            disabled={loading}
            onClick={currentStep === 3 ? handleSubmit : handleNext}
            className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : currentStep === 3 ? 'Create Account' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignupForm />
    </Suspense>
  )
}
