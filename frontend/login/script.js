// frontend/login/script.js

const API_URL = '/graphql';

// Función para hacer la llamada a GraphQL
async function gqlCall(query, variables = {}) {
    const response = await fetch(API_URL , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
        throw new Error('Error en la red');
    }
    const { data, errors } = await response.json();
    if (errors) {
        throw new Error(errors[0].message);
    }
    return data;
}

// Lógica del formulario
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); // Evita que la página se recargue
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // Query de GraphQL para el login
    const LOGIN_MUTATION = `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password)
        }
    `;

    try {
        const data = await gqlCall(LOGIN_MUTATION, { username, password });
        if (data && data.login) {
            // ¡Login exitoso!
            localStorage.setItem('authToken', data.login); // Guardamos el token
            window.location.href = '/admin'; // Redirigimos al panel de admin
        }
    } catch (error) {
        errorMessage.textContent = 'Error: ' + error.message;
    }
});