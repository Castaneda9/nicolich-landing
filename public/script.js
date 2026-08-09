(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  function show(el) {
    el.classList.add("is-visible");
  }

  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach(show);
  } else {
    reveals.forEach(function (el) {
      if (el.closest(".hero")) {
        show(el);
      }
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            show(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    reveals.forEach(function (el) {
      if (!el.closest(".hero")) {
        observer.observe(el);
      }
    });
  }

  var form = document.getElementById("lead-form");
  if (!form) return;

  var statusEl = document.getElementById("lead-status");
  var submitBtn = document.getElementById("lead-submit");
  var endpoint = form.getAttribute("data-endpoint") || "/api/lead";

  function setStatus(kind, text) {
    statusEl.hidden = false;
    statusEl.className = "lead-form__status is-" + kind;
    statusEl.textContent = text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var payload = {
      name: String(data.get("name") || "").trim(),
      contact: String(data.get("contact") || "").trim(),
      topic: String(data.get("topic") || "").trim(),
      message: String(data.get("message") || "").trim(),
    };

    if (!payload.contact) {
      setStatus("err", "Укажите контакт — Telegram, телефон или email.");
      return;
    }
    if (payload.message.length < 5) {
      setStatus("err", "Напишите вопрос или описание чуть подробнее.");
      return;
    }

    submitBtn.disabled = true;
    setStatus("ok", "Отправляем…");

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (_ref) {
        if (_ref.res.ok && _ref.body && _ref.body.ok) {
          setStatus("ok", "Заявка ушла в Telegram. Отвечу в ближайшее время.");
          form.reset();
          var firstTopic = form.querySelector('input[name="topic"][value="A"]');
          if (firstTopic) firstTopic.checked = true;
          return;
        }
        var err =
          (_ref.body && _ref.body.error) ||
          "Не удалось отправить. Напишите напрямую в Telegram @nicoIich.";
        setStatus("err", err);
      })
      .catch(function () {
        setStatus(
          "err",
          "Сервер формы недоступен. Запустите сайт через node server.mjs или напишите @nicoIich."
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
