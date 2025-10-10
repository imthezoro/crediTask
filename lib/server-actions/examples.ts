/**
 * Server Actions Usage Examples
 * Demonstrates how to use the enhanced server actions pattern
 */

'use server'

import { z } from 'zod'
import { enhanceAction, success, error } from './index'

// ============================================
// Example 1: Simple Action (No Validation)
// ============================================

export const simpleAction = enhanceAction({
  name: 'simple-action',
  handler: async () => {
    // Your logic here
    return { message: 'Hello from server action!' }
  },
})

// Usage in component:
// const result = await simpleAction({})

// ============================================
// Example 2: Action with Zod Validation
// ============================================

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
})

export const updateProfile = enhanceAction({
  name: 'update-profile',
  schema: updateProfileSchema,
  handler: async (input) => {
    // Input is automatically validated and typed
    const { name, email, bio } = input
    
    // Your database logic here
    // await db.updateProfile({ name, email, bio })
    
    return { 
      message: 'Profile updated successfully',
      profile: { name, email, bio }
    }
  },
})

// Usage:
// const result = await updateProfile({ name: 'John', email: 'john@example.com' })
// if (result.success) { console.log(result.data) }
// else { console.error(result.error, result.fieldErrors) }

// ============================================
// Example 3: Authenticated Action
// ============================================

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  published: z.boolean().default(false),
})

export const createPost = enhanceAction({
  name: 'create-post',
  schema: createPostSchema,
  auth: {
    required: true,
  },
  handler: async () => {
    // Only authenticated users can reach this code
    // await db.createPost(input)
    
    return {
      message: 'Post created successfully',
      postId: 'post-123',
    }
  },
})

// ============================================
// Example 4: Admin-Only Action
// ============================================

const deleteUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().min(10, 'Please provide a reason'),
})

export const deleteUser = enhanceAction({
  name: 'delete-user',
  schema: deleteUserSchema,
  auth: {
    required: true,
    adminOnly: true,
  },
  handler: async () => {
    // Only admins can reach this code
    // await adminService.deleteUser(input.userId, input.reason)
    
    return {
      message: 'User deleted successfully',
    }
  },
})

// ============================================
// Example 5: Action with Custom Error Handling
// ============================================

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
})

export const sendEmail = enhanceAction({
  name: 'send-email',
  schema: sendEmailSchema,
  handler: async () => {
    try {
      // await emailService.send(input)
      return success({ messageId: 'msg-123' })
    } catch (err) {
      // Custom error handling
      if (err instanceof Error && err.message.includes('rate limit')) {
        return error('Email rate limit exceeded. Please try again later.')
      }
      throw err // Let enhanceAction handle other errors
    }
  },
})

// ============================================
// Example 6: Action Without Logging
// ============================================

export const healthCheck = enhanceAction({
  name: 'health-check',
  logging: false, // Disable logging for frequent actions
  handler: async () => {
    return { status: 'healthy', timestamp: Date.now() }
  },
})

// ============================================
// Example 7: Form Action (Client Component Usage)
// ============================================

// In your client component:
/*
'use client'

import { useState } from 'react'
import { updateProfile } from '@/lib/server-actions/examples'
import { handleActionResult } from '@/lib/server-actions'

export function ProfileForm() {
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    const result = await updateProfile({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      bio: formData.get('bio') as string,
    })

    handleActionResult(result, {
      onSuccess: (data) => {
        setSuccess(true)
        setErrors({})
      },
      onError: (error) => {
        alert(error)
      },
      onFieldErrors: (fieldErrors) => {
        setErrors(fieldErrors)
      },
    })
  }

  return (
    <form action={handleSubmit}>
      <input name="name" />
      {errors.name && <p>{errors.name[0]}</p>}
      
      <input name="email" type="email" />
      {errors.email && <p>{errors.email[0]}</p>}
      
      <textarea name="bio" />
      {errors.bio && <p>{errors.bio[0]}</p>}
      
      <button type="submit">Update Profile</button>
      {success && <p>Profile updated!</p>}
    </form>
  )
}
*/
