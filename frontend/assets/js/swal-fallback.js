(function () {
  if (window.Swal && typeof window.Swal.fire === 'function') return;

  let activeBackdrop = null;

  function resolveColor(value, fallback) {
    return value || fallback;
  }

  function close(result) {
    if (activeBackdrop) {
      activeBackdrop.remove();
      activeBackdrop = null;
    }
    return result;
  }

  window.Swal = {
    isVisible() {
      return Boolean(activeBackdrop && document.body.contains(activeBackdrop));
    },

    close() {
      close({ isConfirmed: false, isDismissed: true });
    },

    fire(options = {}) {
      const cfg = typeof options === 'string' ? { title: options } : options;

      return new Promise((resolve) => {
        if (activeBackdrop) activeBackdrop.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'swal-local-backdrop';
        activeBackdrop = backdrop;

        const popup = document.createElement('div');
        popup.className = 'swal-local-popup';
        popup.style.background = cfg.background || '#ebd5c0';
        popup.style.color = cfg.color || '#000';

        const icon = document.createElement('div');
        icon.className = 'swal-local-icon ' + (cfg.icon || 'info');
        icon.textContent = cfg.icon === 'success' ? 'OK' : cfg.icon === 'error' ? '!' : cfg.icon === 'warning' ? '!' : 'i';
        icon.style.borderColor = resolveColor(cfg.iconColor, cfg.icon === 'success' ? '#16a34a' : cfg.icon === 'warning' ? '#ed6b07' : '#e11d48');
        icon.style.color = icon.style.borderColor;

        const title = document.createElement('h2');
        title.className = 'swal-local-title';
        title.textContent = cfg.title || '';

        const text = document.createElement('p');
        text.className = 'swal-local-text';
        text.textContent = cfg.text || '';

        const html = document.createElement('div');
        html.className = 'swal-local-html';
        if (cfg.html) html.innerHTML = cfg.html;

        const actions = document.createElement('div');
        actions.className = 'swal-local-actions';

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'swal-local-confirm';
        confirm.textContent = cfg.confirmButtonText || 'Aceptar';
        confirm.style.background = resolveColor(cfg.confirmButtonColor, '#ed6b07');

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'swal-local-cancel';
        cancel.textContent = cfg.cancelButtonText || 'Cancelar';
        cancel.style.background = resolveColor(cfg.cancelButtonColor, '#777');

        const done = (result) => {
          close(result);
          resolve(result);
        };

        confirm.addEventListener('click', () => done({ isConfirmed: true, isDismissed: false }));
        cancel.addEventListener('click', () => done({ isConfirmed: false, isDismissed: true }));

        if (cfg.showCancelButton) actions.appendChild(cancel);
        actions.appendChild(confirm);

        backdrop.addEventListener('click', (event) => {
          if (event.target === backdrop && cfg.allowOutsideClick !== false) {
            done({ isConfirmed: false, isDismissed: true });
          }
        });

        document.addEventListener('keydown', function onKeydown(event) {
          if (event.key !== 'Escape') return;
          if (cfg.allowEscapeKey === false) return;
          document.removeEventListener('keydown', onKeydown);
          done({ isConfirmed: false, isDismissed: true });
        });

        popup.append(icon, title);
        if (cfg.html) popup.appendChild(html);
        else if (cfg.text) popup.appendChild(text);
        popup.appendChild(actions);
        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        confirm.focus();
      });
    }
  };
})();
