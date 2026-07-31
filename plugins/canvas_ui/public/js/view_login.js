import { signIn } from './auth.js';

export async function renderLoginView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex items-center justify-center bg-surface-container p-md overflow-y-auto';

    container.innerHTML = `
        <div class="max-w-md w-full bg-surface-container-lowest border-4 border-on-surface p-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-lg relative z-10">
            
            <div class="flex flex-col items-center gap-sm text-center">
                <div class="w-20 h-20 bg-primary-container border-4 border-on-surface rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-sm">
                    <span class="material-symbols-outlined text-[40px] text-on-primary">vpn_key</span>
                </div>
                <h1 class="font-headline-lg text-on-surface font-bold">Stregatto OS</h1>
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
                    <span>Entra</span>
                    <span class="material-symbols-outlined">login</span>
                </button>
            </form>
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

    return container;
}
