# Traina public website

Arabic-first responsive landing page with an English companion, local licensed IBM Plex Arabic fonts, existing Traina photography/identity, native FAQ disclosures and consent-based interest form. The interest form calls the same-origin /api/interest serverless function; it forwards only to the shared Traina API, and the resulting record appears in the admin workspace.

Rebuild static HTML from source: node scripts/build-public-site.mjs (repository root). Deploy apps/www independently to Vercel. TRAINA_API_ORIGIN and WEBSITE_ORIGIN default to the verified staging hostnames and must be changed explicitly for another environment. Legal terms remain draft and commercial payments remain disabled. No launch date, reviews, invented metrics or store download links are fabricated.
