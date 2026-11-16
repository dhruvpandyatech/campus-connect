<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Student feed reads notices through the public `listNotices` server function (publishable key, anon SELECT policy) so SSR works without a session.
- Notice attachments live in the private `notice-attachments` bucket under `<user_id>/...`; `attachment_url` stores `storage:<path>` for uploads (signed on read) or a plain https URL for links. Workspace policy blocks public buckets.
- `notices.sender_name`/`sender_role` are stamped by a DB trigger from the author's profile and frozen on update, so clients cannot spoof the sender.
- Faculty write access is RLS-scoped to their own rows (`created_by = auth.uid()`); there is no in-app sign-up — faculty accounts are added by the admin.
- Category ids and keyword rules live only in `src/lib/categories.ts`; the `notices_category_check` DB constraint must list the same ids.
- `notices.is_pinned` marks high-alert notices; every notice list orders by `is_pinned DESC, created_at DESC` and `NoticeCard` renders the alert banner from it.
- Brand chrome (logo slot, portal name) lives only in `src/components/campus/BrandHeader.tsx` so every page shares it; the emblem comes from the CDN asset pointer in `src/assets/`, and `public/favicon.png` is its square copy.
- Auth sign-ups are disabled at the backend, not just hidden in the UI, so only admin-created accounts can sign in.
