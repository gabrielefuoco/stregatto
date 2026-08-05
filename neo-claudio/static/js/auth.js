// auth.js - Supabase Auth Helper

let config = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
try {
    const res = await fetch('/canvas/config');
    if (res.ok) {
        config = await res.json();
    } else {
        console.warn("Could not fetch Supabase config");
    }
} catch (e) {
    console.warn("Network error fetching config", e);
}

// Inizializza il client di Supabase se le chiavi sono disponibili
export const supabase = window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;

export async function getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function signIn(email, password) {
    if (!supabase) throw new Error("Supabase non inizializzato");
    return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
    if (!supabase) throw new Error("Supabase non inizializzato");
    return supabase.auth.signUp({ email, password });
}

export async function signInWithGoogle() {
    if (!supabase) throw new Error("Supabase non inizializzato");
    return supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/canvas'
        }
    });
}

export async function signOut() {
    if (!supabase) return;
    return supabase.auth.signOut();
}

// Listener globale per lo stato di autenticazione
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.hash = '#login';
        } else if (event === 'SIGNED_IN' && window.location.hash === '#login') {
            window.location.hash = '#chat';
        }
    });
}
