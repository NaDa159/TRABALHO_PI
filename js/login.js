(function () {
    "use strict";

    const form = document.getElementById("form-login");
    const usernameField = document.getElementById("identificacao");
    const passwordField = document.getElementById("senha");
    const errorMessage = document.getElementById("mensagem-erro");
    const submitButton = document.getElementById("login-submit");
    const showPasswordButton = document.getElementById("mostrar-senha");
    const STORAGE_KEY = "paradaInteligente.data.v1";

    function normalized(value) {
        return String(value || "").trim().toLocaleLowerCase("pt-BR");
    }

    function demoAccounts() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (stored && Array.isArray(stored.users)) {
                return stored.users.filter((user) => user && user.active !== false);
            }
        } catch (error) {
            // Invalid local data should not prevent the demonstration login from opening.
        }
        return [
            { id: "demo-admin", username: "admin", password: "12345", role: "administrador", name: "Administrador" },
            { id: "demo-user", username: "usuario", password: "54321", role: "usuario", name: "Usuário" }
        ];
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        errorMessage.textContent = "";

        const username = normalized(usernameField.value);
        const password = passwordField.value;
        if (!password) {
            errorMessage.textContent = "Informe a senha para continuar.";
            passwordField.focus();
            return;
        }

        const account = demoAccounts().find((user) => {
            const matchesPassword = String(user.password || "") === password;
            const matchesUsername = !username || normalized(user.username || user.login) === username;
            return matchesPassword && matchesUsername;
        });

        if (!account || !["administrador", "usuario"].includes(account.role)) {
            errorMessage.textContent = "Identificação ou senha inválida. Confira o acesso de demonstração.";
            passwordField.value = "";
            passwordField.focus();
            return;
        }

        sessionStorage.setItem("perfil", account.role);
        sessionStorage.setItem("usuarioId", String(account.id || ""));
        sessionStorage.setItem("usuarioNome", String(account.name || account.username || ""));
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        submitButton.textContent = "Entrando…";
        window.setTimeout(() => {
            window.location.href = account.role === "administrador" ? "administrador.html" : "usuario.html";
        }, 250);
    });

    showPasswordButton.addEventListener("click", () => {
        const visible = passwordField.type === "password";
        passwordField.type = visible ? "text" : "password";
        showPasswordButton.textContent = visible ? "Ocultar" : "Mostrar";
        showPasswordButton.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
        showPasswordButton.setAttribute("aria-pressed", String(visible));
        passwordField.focus();
    });

    document.getElementById("limpar-login").addEventListener("click", () => {
        form.reset();
        errorMessage.textContent = "";
        passwordField.type = "password";
        showPasswordButton.textContent = "Mostrar";
        showPasswordButton.setAttribute("aria-label", "Mostrar senha");
        showPasswordButton.setAttribute("aria-pressed", "false");
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.textContent = "Entrar no sistema";
        usernameField.focus();
    });
}());
