<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Roles live in `public.user_roles` (checked via `has_role`); the first signup becomes admin via the `handle_new_user` trigger, later accounts are created by the admin through a server function — keeps public signup harmless.
- Hour/wage math lives in `src/lib/time.ts` with tests in `src/test/wage.test.ts` — single source for UI and CSV.
