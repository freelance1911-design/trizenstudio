# Trizen Studio — Photo Sharing Platform

A full-stack photo-sharing platform designed for photography and event teams to collaboratively upload, review, curate, and publish photographs as secure customer galleries.

Built as a Full-Stack Internship Challenge project for TrizenAI Technologies.

---

## Live Application

**Production URL:**  
https://trizenstudio-fawn.vercel.app

**Source Code:**  
https://github.com/freelance1911-design/trizenstudio

---

## Project Overview

Trizen Studio provides a complete workflow for managing event photographs from upload to customer delivery.

The platform supports three types of users:

- **Admin / Lead**
- **Team Member / Photographer**
- **Customer**

The Admin manages events, photographers, uploaded photographs, photo selection, and customer galleries.

Team Members can view their assigned events and upload photographs.

Customers do not need an account. They receive a gallery URL and PIN to securely access published photographs.

---

## Features

### Admin

- Register and log in
- Create events
- Add photographers
- Assign photographers to events
- View all uploaded photographs
- Review photographs
- Select photographs for publishing
- Create galleries
- Set gallery PINs
- Publish galleries
- Generate shareable gallery links
- Remove event assignments
- Delete photographers

### Team Member / Photographer

- Log in securely
- View assigned events
- Upload multiple photographs
- Preview photographs before uploading
- View uploaded photographs
- Delete their own photographs
- View recent uploads
- Cannot access Admin functionality
- Cannot publish galleries
- Cannot manage other users

### Customer

- No account required
- Access gallery using a shareable URL
- Enter gallery PIN
- View published photographs
- Browse the gallery

---

## Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / API | Next.js API Routes |
| Database | PostgreSQL |
| Database Platform | Supabase |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Deployment | Vercel |

---

## Architecture

The application uses Next.js for the frontend and API layer, Supabase for authentication and backend services, PostgreSQL for application metadata, and Supabase Storage for private photographs.

```text
                         ┌──────────────────────┐
                         │      Customer        │
                         │                      │
                         │  Gallery URL + PIN   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Published Gallery   │
                         │                      │
                         │  PIN Verification    │
                         │  Signed Image URLs   │
                         └──────────┬───────────┘
                                    │
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
     ┌──────────────────────┐                   ┌──────────────────────┐
     │        Admin         │                   │    Team Member       │
     │                      │                   │                      │
     │  Create Events       │                   │  Assigned Events     │
     │  Manage Team         │                   │  Upload Photos       │
     │  Review Photos       │                   │  View Own Photos     │
     │  Select Photos       │                   │  Delete Own Photos   │
     │  Manage Galleries    │                   │                      │
     └──────────┬───────────┘                   └──────────┬───────────┘
                │                                          │
                └──────────────────┬───────────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │       Supabase       │
                         │                      │
                         │  Authentication      │
                         │  PostgreSQL          │
                         │  Private Storage     │
                         └──────────┬───────────┘
                                    │
                       ┌────────────┴────────────┐
                       │                         │
                       ▼                         ▼
              ┌─────────────────┐      ┌──────────────────┐
              │   PostgreSQL    │      │ Supabase Storage │
              │                 │      │                  │
              │ Users / Roles   │      │ Private Photos  │
              │ Events          │      │ Event Thumbnails│
              │ Assignments     │      │                  │
              │ Photo Metadata  │      │ Signed URLs     │
              │ Galleries       │      │                  │
              └─────────────────┘      └──────────────────┘
                                   
                         ┌────────────────┐
                         │     Vercel     │
                         │   Deployment   │
                         └────────────────┘
Architecture Flow
Admin creates an event.
Admin adds photographers.
Admin assigns photographers to the event.
Photographers upload event photographs.
Photographs are stored in private Supabase Storage.
PostgreSQL stores photograph metadata.
Admin reviews uploaded photographs.
Admin selects photographs for publishing.
Admin creates a customer gallery.
Admin sets a gallery PIN.
Admin publishes the gallery.
Customer receives the gallery URL and PIN.
Customer enters the PIN.
The gallery API verifies the PIN.
Temporary signed URLs are generated for private photographs.
Customer views the published gallery.
Project Structure
photo-sharing-platform/
│
├── app/
│   │
│   ├── admin/
│   │   ├── page.tsx
│   │   └── events/
│   │       ├── page.tsx
│   │       ├── new/
│   │       │   └── page.tsx
│   │       └── [id]/
│   │           ├── page.tsx
│   │           ├── photos/
│   │           │   └── page.tsx
│   │           └── gallery/
│   │               └── page.tsx
│   │
│   ├── api/
│   │   ├── admin/
│   │   │   └── photographers/
│   │   │       └── route.ts
│   │   │
│   │   └── gallery/
│   │       └── access/
│   │           └── route.ts
│   │
│   ├── gallery/
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── login/
│   │   └── page.tsx
│   │
│   ├── team/
│   │   └── page.tsx
│   │
│   ├── layout.tsx
│   └── globals.css
│
├── src/
│   └── lib/
│       └── supabase/
│           └── client.ts
│
├── public/
│
├── supabase/
│
├── .env.local
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── README.md
Database

The application uses PostgreSQL through Supabase.

Main Tables
Table	Purpose
profiles	Stores users and their application roles
events	Stores photography events
event_members	Connects photographers with events
photos	Stores photograph metadata
galleries	Stores customer gallery information
gallery_photos	Connects selected photographs to galleries
Profiles

Stores application-level user information and roles.

Column	Description
id	Unique user ID linked to Supabase Auth
full_name	User's full name
email	User's email address
role	User role: ADMIN or TEAM_MEMBER
created_at	Account creation timestamp
Events

Stores photography projects and events.

Column	Description
id	Unique event ID
name	Event name
description	Event description
event_date	Event date
thumbnail_path	Storage path for the event thumbnail
event_created_by	Admin who created the event
created_at	Event creation timestamp
Event Members

Connects photographers with their assigned events.

Column	Description
id	Unique assignment ID
event_id	Assigned event
user_id	Assigned team member
Photos

Stores metadata for uploaded photographs.

Column	Description
id	Unique photo ID
event_id	Event associated with the photo
uploaded_by	Team member who uploaded the photo
filename	Original file name
storage_path	Supabase Storage location
file_size	File size in bytes
created_at	Upload timestamp

The actual image files are stored in Supabase Storage.

The PostgreSQL database stores only photograph metadata and storage paths.

Galleries

Stores customer gallery information.

Column	Description
id	Unique gallery ID
event_id	Event associated with the gallery
slug	Unique shareable gallery identifier
pin_hash	SHA-256 hash of the gallery PIN
published	Gallery publication status
created_at	Gallery creation timestamp
published_at	Gallery publication timestamp
Gallery Photos

Connects selected photographs to galleries.

Column	Description
id	Unique gallery-photo record
gallery_id	Gallery ID
photo_id	Selected photo ID
created_at	Selection timestamp
Storage

The application uses a private Supabase Storage bucket named:

photos

Images are stored using an event and photographer-based structure:

photos/
│
├── {event-id}/
│   └── {photographer-id}/
│       ├── photo-1.jpg
│       ├── photo-2.jpg
│       └── photo-3.jpg
│
└── event-thumbnails/
    └── {event-id}/
        └── thumbnail.webp

Images are not stored directly inside PostgreSQL.

Instead:

Supabase Storage stores the actual image files.
PostgreSQL stores photograph metadata.
Storage paths are stored in the photos table.
Private photographs are accessed using temporary signed URLs.
Authentication & Authorization

Supabase Authentication handles user authentication.

Application roles are stored in the profiles table.

Supported Roles
ADMIN
TEAM_MEMBER
Admin Permissions

Administrators can:

Create events
Manage photographers
Assign photographers to events
View all uploaded photographs
Review photographs
Select photographs
Create galleries
Publish galleries
Delete photographers
Remove event assignments
Team Member Permissions

Team Members can:

Log in
View assigned events
Upload photographs
View their own photographs
Delete their own photographs

Team Members cannot:

Manage other users
Access Admin functionality
Publish galleries
Manage other photographers' photographs
Customer Permissions

Customers do not need an account.

Customers can only access a published gallery after providing the correct gallery PIN.

Gallery Security

Customer galleries are private by default.

A gallery must be explicitly published by an administrator before it becomes accessible.

Gallery Access

Customers require:

Gallery URL
+
Gallery PIN

Gallery PINs are never stored as plain text.

They are stored as SHA-256 hashes.

The gallery access API:

Receives the gallery slug and PIN.
Verifies the PIN against the stored hash.
Checks that the gallery is published.
Retrieves only photographs selected for the gallery.
Generates temporary signed URLs.
Returns the protected photographs to the customer.

Photographs are stored in a private storage bucket and are not directly publicly accessible.

Environment Variables

Create a .env.local file in the project root.

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
Important

Never commit .env.local or other secrets to GitHub.

The SUPABASE_SERVICE_ROLE_KEY is a server-side secret and must never be exposed to the browser.

Make sure .env.local is included in .gitignore.

Local Development
1. Clone the Repository
git clone https://github.com/freelance1911-design/trizenstudio.git
2. Enter the Project
cd trizenstudio
3. Install Dependencies
npm install
4. Configure Environment Variables

Create:

.env.local

Add the required Supabase credentials.

5. Start the Development Server
npm run dev

The application will be available at:

http://localhost:3000
Supabase Setup

Create a Supabase project and configure the following services.

Authentication

Enable:

Email/password authentication
Email invitations for team members
Database

Create the required tables:

profiles
events
event_members
photos
galleries
gallery_photos

Configure Row Level Security policies for the application.

Storage

Create a private bucket:

photos

Configure storage policies for authenticated users.

Initial Admin Account

The application requires an administrator account to manage the workspace.

For production, create the initial admin account through Supabase Authentication and assign:

role = ADMIN

in the profiles table.

Do not hard-code administrator credentials in the application source code.

Photographer Onboarding

Administrators can add photographers from:

Team → Add Photographer

The administrator provides:

Full name
Email address

The application creates the photographer account and generates a secure invitation/setup link.

The photographer uses the setup link to configure their password before accessing the workspace.

Event Workflow

The typical workflow is:

1. Admin creates an event
          ↓
2. Admin adds photographers
          ↓
3. Admin assigns photographers
          ↓
4. Photographers upload photographs
          ↓
5. Admin reviews photographs
          ↓
6. Admin selects photographs
          ↓
7. Admin creates a gallery
          ↓
8. Admin sets gallery PIN
          ↓
9. Admin publishes gallery
          ↓
10. Customer receives gallery URL + PIN
          ↓
11. Customer enters PIN
          ↓
12. Customer views published photographs
Photo Upload Flow

Photographers can upload multiple images.

Supported Formats
JPEG
PNG
WebP
Maximum Individual File Size
20 MB

Before uploading, photographers can preview selected images.

The upload process is:

Select photographs
        ↓
Validate file type
        ↓
Validate file size
        ↓
Upload to Supabase Storage
        ↓
Store metadata in PostgreSQL
        ↓
Display uploaded photographs
Error Handling

The application handles common failure cases including:

Invalid login credentials
Expired authentication sessions
Missing user profiles
Unauthorized access
Invalid roles
Invalid file types
Oversized files
Failed photo uploads
Database insertion failures
Invalid gallery PINs
Unpublished galleries
Deleted photographer accounts
Performance

Several performance optimizations are included:

Parallel Supabase requests
Batched signed URL generation
Limited initial photo queries
Lazy-loaded images
Image previews before upload
Upload progress indicators
Limited dashboard queries
Skeleton loading states

For larger production photo libraries, additional improvements can include:

Pagination
Infinite scrolling
Image thumbnails
CDN optimization
Server-side image resizing
Deployment

The application is deployed using Vercel.

Production Build

To create a production build locally:

npm run build
Start Production Server
npm start
Vercel Environment Variables

Add the following environment variables to the Vercel project:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY

Use the same Supabase project configured for the application.

Production Configuration

After deployment, configure Supabase Authentication with the production Vercel URL.

Configure
Site URL
Redirect URLs

Production URL:

https://trizenstudio-fawn.vercel.app

For authentication flows, make sure the production domain is included in the allowed redirect URLs.

Do not use localhost URLs for production authentication redirects.

Testing Checklist
Authentication
 Admin can log in
 Photographer can log in
 Invalid credentials are rejected
 Logged-out users cannot access protected workspaces
 Deleted photographers cannot access the workspace
Admin
 Admin can create events
 Admin can add photographers
 Admin can assign photographers
 Admin can remove event assignments
 Admin can delete photographers
 Admin can view uploaded photographs
 Admin can select photographs
 Admin can create galleries
 Admin can publish galleries
Photographer / Team Member
 Photographer can view assigned events
 Photographer cannot access Admin functionality
 Photographer can upload photographs
 Multiple uploads work correctly
 Invalid file types are rejected
 Files above 20 MB are rejected
 Photographer can view their own photographs
 Photographer can delete their own photographs
Customer
 Customer does not need an account
 Gallery requires a PIN
 Incorrect PIN is rejected
 Unpublished galleries cannot be accessed
 Published gallery photographs load correctly
 Private storage files are not publicly accessible
Security Considerations

The application follows several security principles:

Supabase Authentication
Role-based authorization
PostgreSQL Row Level Security
Private object storage
Temporary signed URLs
Hashed gallery PINs
Server-side service-role operations
Input validation
File type validation
File size validation
Unauthorized access protection

The Supabase service-role key is used only in server-side code.

Future Improvements

Potential improvements include:

Image thumbnail generation
Automatic image resizing
Infinite scrolling
Pagination
Bulk photo download
Bulk photo selection
Gallery expiration
Customer favorites
Photo comments
Search and filtering
Drag-and-drop gallery ordering
Activity audit logs
Email notifications
Advanced analytics
Design

The interface follows an editorial photography aesthetic rather than a traditional SaaS dashboard.

Design Principles
Warm ivory backgrounds
Dark charcoal typography
Serif editorial headings
Minimal borders
Generous whitespace
Photography-focused layouts
Responsive design
Subtle interactions
Premium visual hierarchy

The design is intended to feel like a professional photography studio workspace rather than a generic administration dashboard.

Project Status

Status: Production-ready MVP

The core workflow is implemented:

Authentication
      ↓
Team Management
      ↓
Event Management
      ↓
Photographer Assignments
      ↓
Photo Upload
      ↓
Photo Review
      ↓
Photo Selection
      ↓
Gallery Creation
      ↓
PIN Protection
      ↓
Gallery Publishing
      ↓
Customer Delivery
License

This project was developed as a full-stack photography workspace application for demonstration and internship evaluation purposes.