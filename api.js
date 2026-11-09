// api.js - Custom API wrapper

const API = {
    _csrfToken:null,
    async request(url, method = 'GET', body = null) {
        if(method!=='GET'&&!API._csrfToken){const init=await API.request('api/auth.php?action=session');if(init.error)return init;} 
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if(method!=='GET')options.headers['X-CSRF-Token']=API._csrfToken;
        if (body) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        try {
            const res = await fetch(url, options);
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch(e) {
                return { error: { message: "Server error: " + text } };
            }
            if(data.csrf)API._csrfToken=data.csrf;
            if (!res.ok) {
                return { error: { message: data.error || 'Request failed' } };
            }
            return { data, error: null };
        } catch (e) {
            return { error: { message: "Network error: " + e.message } };
        }
    },
    
    _authCallbacks: [],
    
    auth: {
        async signInWithPassword({ email, password }) {
            const res = await API.request('api/auth.php?action=login', 'POST', { email, password });
            if(res.data && res.data.success) {
                const session = { user: res.data.user };
                API._authCallbacks.forEach(cb => cb('SIGNED_IN', session));
                return { data: { session }, error: null };
            }
            return res;
        },
        async signUp({ email, password }) {
            const res = await API.request('api/auth.php?action=register', 'POST', { email, password });
            if(res.data && res.data.success) {
                const session = { user: res.data.user };
                API._authCallbacks.forEach(cb => cb('SIGNED_IN', session));
                return { data: { session }, error: null };
            }
            return res;
        },
        async signOut() {
            const result=await API.request('api/auth.php?action=logout','POST');if(result.error)return result;API._csrfToken=null;
            API._authCallbacks.forEach(cb => cb('SIGNED_OUT', null));
            return { error: null };
        },
        async resetPasswordForEmail(email) {
            return { error: { message: "পাসওয়ার্ড রিসেট সিস্টেম এখনো চালু হয়নি (Email server not configured)।" } };
        },
        async updateUser({ password }) {
            return await API.request('api/auth.php?action=update_password', 'POST', { password });
        },
        onAuthStateChange(callback) {
            API._authCallbacks.push(callback);
            API.request('api/auth.php?action=session', 'GET').then(res => {
                if(res.data && res.data.user) {
                    callback('SIGNED_IN', { user: res.data.user });
                } else {
                    callback('SIGNED_OUT', null);
                }
            });
        }
    },
    
    data: {
        async load(type = 'hisab') {
            const res = await API.request(`api/data.php?action=get&type=${type}`, 'GET');
            if(res.error)return res;
            // Check if it's the empty structure from API
            if (res.data && res.data.data === null) {
                return { data: null };
            }
            // If it returns raw JSON data object from DB
            return { data: { data: res.data } };
        },
        async save(payload, type = 'hisab') {
            return await API.request(`api/data.php?action=save&type=${type}`, 'POST', payload);
        }
    }
};

window.sb = API; // Override sb
