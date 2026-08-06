import { signUp } from './auth.js';

export async function renderRegisterView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex items-center justify-center bg-surface-container p-md overflow-y-auto';

    container.innerHTML = `
        <div class="max-w-md w-full bg-surface-container-lowest border-4 border-on-surface p-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-lg relative z-10">
            
            <div class="flex flex-col items-center gap-sm text-center">
                <div class="w-20 h-20 bg-primary-container border-4 border-on-surface rounded-none flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-sm">
                    <span class="material-symbols-outlined text-[40px] text-on-primary">person_add</span>
                </div>
                <h1 class="font-headline-lg text-on-surface font-bold">Crea un Account</h1>
                <p class="font-body-md text-on-surface-variant">Inizia il tuo viaggio nello Stregatto OS</p>
            </div>

            <form id="register-form" class="flex flex-col gap-md">
                <div class="flex flex-col gap-xs">
                    <label class="font-label-md uppercase tracking-widest text-secondary">Email</label>
                    <input type="email" id="reg-email" required class="w-full bg-surface p-sm border-2 border-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md" placeholder="nome@esempio.com">
                </div>

                <div class="flex flex-col gap-xs">
                    <label class="font-label-md uppercase tracking-widest text-secondary">Password</label>
                    <input type="password" id="reg-password" required minlength="6" class="w-full bg-surface p-sm border-2 border-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md" placeholder="••••••••">
                </div>

                <div id="reg-msg" class="hidden p-sm font-label-md mt-sm border-2"></div>

                <button type="submit" class="mt-md w-full bg-primary text-on-primary font-label-md uppercase tracking-wider py-md px-lg border-4 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-center items-center gap-sm">
                    <span>Registrati</span>
                    <span class="material-symbols-outlined">how_to_reg</span>
                </button>
            </form>

            <div class="mt-sm text-center">
                <a href="#login" class="font-label-md text-secondary hover:text-primary transition-colors hover:underline">Hai già un account? Accedi</a>
            </div>
        </div>
    `;

    const form = container.querySelector('#register-form');
    const emailInput = container.querySelector('#reg-email');
    const passwordInput = container.querySelector('#reg-password');
    const msgDiv = container.querySelector('#reg-msg');
    const submitBtn = container.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        msgDiv.className = 'hidden';
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="animation: spin 1s linear infinite;">sync</span><span>Creazione...</span>';

        try {
            const { data, error } = await signUp(emailInput.value, passwordInput.value);
            if (error) {
                throw error;
            }
            
            // Supabase by default requires email confirmation, so we show a success message
            if (data?.user?.identities?.length === 0) {
                // Se l'identità esiste già
                throw new Error("Utente già registrato o in attesa di conferma.");
            }

            msgDiv.textContent = "Registrazione completata! (Controlla l'email se richiesta o accedi).";
            msgDiv.className = 'bg-primary-container text-on-primary-container border-2 border-on-primary-container p-sm font-label-md mt-sm';
            
            // Optional: Auto redirect to login after 3 seconds
            setTimeout(() => {
                window.location.hash = '#login';
            }, 3000);

        } catch (err) {
            console.error("Register error:", err);
            msgDiv.textContent = err.message || "Errore durante la registrazione";
            msgDiv.className = 'bg-error-container text-on-error-container border-2 border-error p-sm font-label-md mt-sm';
            submitBtn.disabled = false;
        } finally {
            if (!submitBtn.disabled) {
                submitBtn.innerHTML = originalText;
            }
        }
    });

    return container;
}
