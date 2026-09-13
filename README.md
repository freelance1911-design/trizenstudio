# Trizen Studio — Photo Sharing & Gallery Platform

A full-stack photography workspace built for photography and event teams to manage events, collaborate with photographers, upload and curate photographs, and publish secure customer galleries.

The platform provides separate experiences for **Administrators**, **Photographers/Team Members**, and **Customers**.

---

## ✦ Features

### Admin

Administrators can:

- Register and log in securely
- Create and manage photography events
- Add photographers to the team
- Assign photographers to events
- View photographer activity
- Monitor uploads
- View all photographs uploaded to events
- Curate photographs for customer galleries
- Create and publish customer galleries
- Set a secure gallery PIN
- Generate shareable gallery links
- Manage team members
- Delete photographer accounts

### Photographer / Team Member

Photographers can:

- Log in securely
- View assigned events
- View event details
- Upload photographs
- Upload multiple photographs
- Preview photographs before uploading
- View their recent uploads
- Delete their own uploaded photographs
- Track upload progress

Photographers cannot:

- Manage other photographers
- Assign photographers to events
- Publish galleries
- Manage gallery access
- Access administrative functionality

### Customer

Customers do not need an account.

They can:

1. Open a shared gallery URL
2. Enter the gallery PIN
3. Access the published photographs
4. Browse the gallery securely

Unpublished galleries cannot be accessed by customers.

---

# Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- Next.js API Routes
- Supabase

## Database

- PostgreSQL via Supabase

## Authentication

- Supabase Authentication
- Role-based authorization

Roles:

ADMIN
TEAM_MEMBER
Storage
Supabase Storage
Private storage bucket
Signed URLs for protected photographs
Deployment
Vercel

## Architecture

The application follows a role-based architecture using Next.js for the
frontend and API layer, Supabase for authentication, PostgreSQL for
metadata, and Supabase Storage for private photo files.

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
        ┌───────────────────────────┴──────────────────────────┐
        │                                                      │
        ▼                                                      ▼
┌──────────────────────┐                            ┌──────────────────────┐
│        Admin         │                            │    Team Member       │
│                      │                            │                      │
│  Create Events       │                            │  Assigned Events     │
│  Manage Team         │                            │  Upload Photos       │
│  Review Photos       │                            │  View Own Photos     │
│  Select Photos       │                            │                      │
│  Manage Galleries    │                            │                      │
└──────────┬───────────┘                            └──────────┬───────────┘
           │                                                   │
           └──────────────────────┬────────────────────────────┘
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
                         ┌──────────┴───────────┐
                         │                      │
                         ▼                      ▼
                ┌─────────────────┐    ┌──────────────────┐
                │   PostgreSQL    │    │ Supabase Storage │
                │                 │    │                  │
                │ Users / Roles   │    │ Private Photos  │
                │ Events          │    │ Event Thumbnails│
                │ Assignments     │    │                  │
                │ Photo Metadata  │    │ Signed URLs     │
                │ Galleries       │    │                  │
                └─────────────────┘    └──────────────────┘

                         Deployment
                              │
                              ▼
                         ┌──────────┐
                         │  Vercel  │
                         └──────────┘
##Project Structure

photo-sharing-platform/
│
├── app/
│   │
│   ├── admin/
│   │   ├── page.tsx
│   │   │
│   │   └── events/
│   │       ├── page.tsx
│   │       ├── new/
│   │       │   └── page.tsx
│   │       │
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
│   └── team/
│       └── page.tsx
│
├── src/
│   └── lib/
│       └── supabase/
│           └── client.ts
│
├── public/
│   └── ...
│
├── .env.local
├── package.json
├── tsconfig.json
└── README.md
## Database

The application uses **PostgreSQL through Supabase**.

### Main Tables

- `profiles`
- `events`
- `event_members`
- `photos`
- `galleries`
- `gallery_photos`

### Profiles

Stores application-level user information and roles.

| Column | Description |
|---|---|
| `id` | Unique user ID linked to Supabase Auth |
| `full_name` | User's full name |
| `email` | User's email address |
| `role` | User role (`ADMIN` or `TEAM_MEMBER`) |
| `created_at` | Account creation timestamp |

### Events

Stores photography projects and events.

| Column | Description |
|---|---|
| `id` | Unique event ID |
| `name` | Event name |
| `description` | Event description |
| `event_date` | Date of the event |
| `thumbnail_path` | Storage path for the event thumbnail |
| `event_created_by` | Admin who created the event |
| `created_at` | Event creation timestamp |

### Event Members

Connects photographers with their assigned events.

| Column | Description |
|---|---|
| `id` | Unique assignment ID |
| `event_id` | Assigned event |
| `user_id` | Assigned team member |

### Photos

Stores metadata for uploaded photographs.

| Column | Description |
|---|---|
| `id` | Unique photo ID |
| `event_id` | Event associated with the photo |
| `uploaded_by` | Team member who uploaded the photo |
| `filename` | Original file name |
| `storage_path` | Supabase Storage location |
| `file_size` | File size in bytes |
| `created_at` | Upload timestamp |

The actual image files are stored in **Supabase Storage**.

The database stores only photo metadata and storage paths.

### Galleries

Stores customer gallery information.

| Column | Description |
|---|---|
| `id` | Unique gallery ID |
| `event_id` | Event associated with the gallery |
| `slug` | Unique shareable gallery identifier |
| `pin_hash` | SHA-256 hash of the gallery PIN |
| `published` | Gallery publication status |
| `created_at` | Gallery creation timestamp |
| `published_at` | Gallery publication timestamp |

### Gallery Photos

Connects selected photographs to galleries.

| Column | Description |
|---|---|
| `id` | Unique gallery-photo record |
| `gallery_id` | Gallery ID |
| `photo_id` | Selected photo ID |
| `created_at` | Selection timestamp |

---

## Storage

The application uses a **private Supabase Storage bucket** named:

```text
photos

Images are stored using an event/user-based structure:
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
PostgreSQL stores photo metadata.
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
Review and curate photographs
Create galleries
Publish galleries
Delete photographers
Photographer / Team Member Permissions

Team members can:

Log in to the workspace
View assigned events
Upload photographs
View their own uploaded photographs
Delete their own photographs

Team members cannot:

Manage other users
Access administrative functionality
Publish galleries
Customer Permissions

Customers do not need an account.

They can only access a published gallery by providing:

Gallery URL
Correct gallery PIN
Gallery Security

Customer galleries are private by default.

A gallery must be explicitly published by an administrator before it becomes accessible.
Gallery access requires:

Gallery URL
+
Gallery PIN

Gallery PINs are not stored as plain text.

They are stored as SHA-256 hashes.

The gallery access API verifies the PIN before returning gallery photographs.

Photographs are stored in a private storage bucket and delivered using temporary signed URLs.

##Environment Variables:

Create a .env.local file in the project root.

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

##Important

Never commit .env.local to GitHub.

The service-role key is a server-side secret and must never be exposed to the browser.

Make sure .env.local is included in .gitignore.

##Local Development:
1. Clone the repository
git clone https://github.com/freelance1911-design/trizenstudio.git
2. Enter the project
cd trizenstudio
3. Install dependencies
npm install
4. Configure environment variables

Create:

.env.local

and add the Supabase credentials.

5. Start the development server
npm run dev

The application will be available at:

http://localhost:3000
Supabase Setup

Create a Supabase project and configure:

##Authentication:

Enable email/password authentication.

##Database

Create the required tables:

profiles
events
event_members
photos
galleries
gallery_photos

Configure Row Level Security policies for the application.

##Storage

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

Team → Add photographer

The administrator provides:

Full name
Email address

The application creates the photographer's account and generates a secure setup link.

The photographer uses the setup link to configure their password.

Event Workflow

The typical workflow is:

1. Admin creates event
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
7. Admin creates gallery
          ↓
8. Admin sets gallery PIN
          ↓
9. Admin publishes gallery
          ↓
10. Customer receives gallery URL + PIN
Photo Upload Flow

Photographers can upload multiple images.

Supported formats:

JPEG
PNG
WebP

Maximum individual file size:

20 MB

Before uploading, photographers can preview selected images.

Uploaded files are stored in Supabase Storage.

After successful storage upload, metadata is inserted into PostgreSQL.

Error Handling

The application handles common failure cases including:

Invalid login credentials
Expired sessions
Missing user profiles
Unauthorized access
Invalid roles
Invalid file types
Oversized files
Failed uploads
Database insertion failures
Invalid gallery PINs
Unpublished galleries
Deleted photographer accounts
Performance

Several optimizations are included:

Parallel Supabase requests
Batched signed URL generation
Limited initial photo queries
Lazy-loaded images
Image previews before upload
Upload progress indicators
Limited dashboard queries
Skeleton loading states

For larger production libraries, pagination/infinite scrolling and image thumbnails can be added to further improve performance.

##Deployment

The application is designed to be deployed using Vercel.

Build
npm run build
Start production server
npm start
Vercel Environment Variables

Add the following environment variables in Vercel:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY

Use the same Supabase project configured for the application.

Production Configuration

After deployment, update Supabase Authentication settings with the production Vercel URL.

##Configure:

Site URL
Redirect URLs

to include the production domain.

For example:

https://your-project.vercel.app

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
 Admin can remove assignments
 Admin can delete photographers
 Admin can view uploaded photographs
 Admin can create galleries
 Admin can publish galleries
Photographer
 Photographer sees assigned events
 Photographer cannot access admin functionality
 Photographer can upload photos
 Multiple uploads work
 Invalid file types are rejected
 Files above 20 MB are rejected
 Photographer can delete their own photos
Customer
 Customer does not need an account
 Gallery requires PIN
 Incorrect PIN is rejected
 Unpublished galleries cannot be accessed
 Published gallery photographs load correctly
 Private storage files are not publicly accessible
Security Considerations

The application follows several security principles:

Supabase Authentication for user authentication
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
Bulk download
Bulk photo selection
Gallery expiration
Customer favorites
Photo comments
Search and filtering
Drag-and-drop gallery ordering
Activity audit logs
Email notifications
Photographer invitation emails
Advanced analytics
Design

The interface follows an editorial photography aesthetic rather than a traditional SaaS dashboard.

Design principles include:

Warm ivory backgrounds
Dark charcoal typography
Serif editorial headings
Minimal borders
Generous whitespace
Photography-focused layouts
Responsive design
Subtle interactions
Premium visual hierarchy
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
Gallery Creation
      ↓
PIN Protection
      ↓
Customer Delivery
License

This project was developed as a full-stack photography workspace application for demonstration and evaluation purposes.


### One thing before you commit

Since we're deploying now, make sure `.gitignore` contains:

```gitignore
.env.local
.env*.local
.next/
node_modules/
