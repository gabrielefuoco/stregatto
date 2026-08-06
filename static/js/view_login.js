import { signIn } from './auth.js';

export async function renderLoginView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex items-center justify-center bg-surface-container p-md overflow-y-auto';

    container.innerHTML = `
        <div class="max-w-md w-full bg-surface-container-lowest border-4 border-on-surface p-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-lg relative z-10">
            
            <div class="flex flex-col items-center gap-sm text-center">
                <div class="w-20 h-20 bg-primary-container border-4 border-on-surface rounded-none flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-sm">
                    <span class="material-symbols-outlined text-[40px] text-on-primary">vpn_key</span>
                </div>
                <h1 class="font-headline-lg text-on-surface font-bold">Neo-Claudio</h1>
                <p class="font-body-md text-on-surface-variant">Accedi al tuo spazio neurale</p>
            </div>

            <form id="login-form" class="flex flex-col gap-md">
                <div class="flex flex-col gap-xs">
                    <label class="font-label-md uppercase tracking-widest text-secondary">Email</label>
                    <input type="email" id="login-email" required class="w-full bg-surface p-sm border-2 border-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md" placeholder="nome@esempio.com">
                </div>

                <div class="flex flex-col gap-xs">
                    <label class="font-label-md uppercase tracking-widest text-secondary">Password</label>
                    <input type="password" id="login-password" required class="w-full bg-surface p-sm border-2 border-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md" placeholder="••••••••">
                </div>

                <div id="login-error" class="hidden bg-error-container text-on-error-container border-2 border-error p-sm font-label-md mt-sm"></div>

                <button type="submit" class="mt-md w-full bg-primary text-on-primary font-label-md uppercase tracking-wider py-md px-lg border-4 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-center items-center gap-sm">
                    <span>Entra con Email</span>
                    <span class="material-symbols-outlined">login</span>
                </button>

                <div class="flex items-center gap-sm my-xs">
                    <div class="h-[4px] bg-on-surface flex-1"></div>
                    <span class="font-label-md uppercase tracking-widest text-on-surface font-bold">Oppure</span>
                    <div class="h-[4px] bg-on-surface flex-1"></div>
                </div>

                <button type="button" id="google-login-btn" class="w-full bg-surface-container-lowest text-on-surface font-label-md uppercase tracking-wider py-md px-lg border-4 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-center items-center gap-sm hover:bg-surface-variant">
                    <svg class="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Google</span>
                </button>
            </form>

            <div class="mt-sm text-center">
                <a href="#register" class="font-label-md text-secondary hover:text-primary transition-colors hover:underline">Non hai un account? Registrati</a>
            </div>
        </div>
    `;

    const form = container.querySelector('#login-form');
    const emailInput = container.querySelector('#login-email');
    const passwordInput = container.querySelector('#login-password');
    const errorDiv = container.querySelector('#login-error');
    const submitBtn = container.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        errorDiv.classList.add('hidden');
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="animation: spin 1s linear infinite;">sync</span><span>Accesso...</span>';

        try {
            const { error } = await signIn(emailInput.value, passwordInput.value);
            if (error) {
                throw error;
            }
            // auth.js global listener triggers window.location.hash = '#chat'
        } catch (err) {
            console.error("Login error:", err);
            errorDiv.textContent = err.message || "Errore durante l'accesso";
            errorDiv.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    const googleBtn = container.querySelector('#google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            errorDiv.classList.add('hidden');
            const originalText = googleBtn.innerHTML;
            googleBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="animation: spin 1s linear infinite;">sync</span><span>Reindirizzamento...</span>';
            
            try {
                // We import signInWithGoogle lazily or destructured at top
                const { signInWithGoogle } = await import('./auth.js');
                const { error } = await signInWithGoogle();
                if (error) throw error;
            } catch (err) {
                console.error("Google Login error:", err);
                errorDiv.textContent = err.message || "Errore durante l'accesso con Google";
                errorDiv.classList.remove('hidden');
                googleBtn.innerHTML = originalText;
            }
        });
    }

    return container;
}
