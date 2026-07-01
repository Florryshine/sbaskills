\# Shiney Brain Academy (SBA)

Project Constitution

Version: 1.0



\---



\# Mission



Shiney Brain Academy exists to become the Operating System for African Education.



We build tools that help African students learn, practice, remember, prepare for examinations, develop skills, and transition into careers.



Every feature should move us closer to becoming the platform a student can use from secondary school through university and beyond.



\---



\# Core Principles



Before writing code:



\- Understand the existing implementation.

\- Search the repository before creating new code.

\- Reuse existing components whenever possible.

\- Fix root causes instead of symptoms.

\- Keep code simple.

\- Preserve existing functionality.

\- Explain major architectural changes before implementing them.



Never guess.



Investigate first.



\---



\# Product Philosophy



SBA is not just a CBT website.



It is a collection of independent systems that work together.



Examples include:



\- Learning Platform

\- Blog Engine

\- Knowledge Asset Engine

\- Quiz Engine

\- Boss Battle Engine

\- Flashcard Engine

\- AI Tutor

\- Video Engine

\- Student Analytics

\- Library

\- Skills Platform



Every system should be modular.



One system failing must not break another.



\---



\# Current Technology



Frontend

\- Next.js App Router

\- React

\- Tailwind CSS



Backend

\- Next.js API Routes



Database

\- Supabase PostgreSQL



Authentication

\- Supabase Auth



Storage

\- Supabase Storage



Deployment

\- Vercel



AI

\- Gemini (Primary)

\- Groq (Fallback)



Video Generation

\- Python



\---



\# Current Architecture



The project is gradually moving toward a Knowledge Asset architecture.



Long term:



Topic

↓

Knowledge Asset

↓

Blog

Quiz

Flashcards

Boss Battle

Video

SEO

Social Media

AI Tutor



Every future engine should consume the same knowledge instead of generating information independently.



Until that migration is complete:



content\_drafts is the canonical source for generated educational content.



Legacy tables should only be maintained for compatibility.



\---



\# Environment Rules



Never hardcode secrets.



Always use environment variables.



Standard names:



GEMINI\_API\_KEY



GROQ\_API\_KEY



NEXT\_PUBLIC\_SUPABASE\_URL



NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY



SUPABASE\_SERVICE\_ROLE\_KEY



Use the same names across:



\- .env.local

\- Vercel

\- Python scripts



\---



\# Coding Rules



Always return complete files when modifying code.



Do not return partial snippets unless specifically requested.



Never delete existing functionality unless instructed.



Keep components reusable.



Separate business logic from UI.



Keep APIs independent.



Document significant architectural changes.



\---



\# Database Rules



Never drop production tables.



Prefer migrations.



Use:



ALTER TABLE ... ADD COLUMN IF NOT EXISTS



instead of assuming schema state.



Prefer:



maybeSingle()



instead of



single()



unless uniqueness is guaranteed.



\---



\# Investigation Rules



Before making changes:



1\. Inspect the repository.

2\. Identify affected files.

3\. Identify affected routes.

4\. Identify affected database tables.

5\. Explain the current workflow.

6\. Explain what will change.

7\. Only then modify code.



\---



\# Definition of Done



A task is not complete until:



✓ Project builds successfully



✓ Existing functionality still works



✓ Admin workflow works



✓ Student workflow works



✓ No console errors



✓ No TypeScript or lint errors (where applicable)



✓ Database migration succeeds



✓ Documentation updated if architecture changed



\---



\# AI Team



CEO

Florry



CTO

ChatGPT



Lead Engineer

Gemini CLI



Code Reviewer

DeepSeek



Assistant

GitHub Copilot



Responsibilities:



ChatGPT

\- Architecture

\- Planning

\- Code review

\- Documentation

\- Long-term decisions



Gemini CLI

\- Repository investigation

\- Implementation

\- Refactoring

\- Python

\- Next.js

\- Automation



DeepSeek

\- Bug hunting

\- Logic review

\- Performance review



GitHub Copilot

\- Autocomplete

\- Small functions

\- Boilerplate



\---



\# Current Priority



Priority 1



Stabilize the existing platform.



Do not build new systems while existing systems remain unstable.



Current focus:



\- API key cleanup

\- Blog Engine

\- Content Engine

\- Image pipeline

\- Knowledge Asset foundation



Only after stabilization should new engines be added.



\---



\# Long-Term Vision



Shiney Brain Academy should become a platform where one educational topic can automatically produce:



\- Blog

\- Quiz

\- CBT Practice

\- Flashcards

\- Boss Battle

\- Video

\- Revision Notes

\- Social Posts

\- SEO Assets

\- AI Tutor Content



using a shared knowledge source.



\---



\# Final Rule



Every change should make the project:



\- simpler

\- cleaner

\- more reusable

\- easier to maintain

\- easier to scale



Never increase complexity without a clear benefit.

