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

  var dock = document.getElementById("dock");
  var contact = document.getElementById("contact");

  if (dock) {
    var contactVisible = false;

    function updateDock() {
      var scrolled = window.pageYOffset > 480;
      dock.classList.toggle("is-visible", scrolled && !contactVisible);
    }

    if (contact && "IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          contactVisible = entries[0].isIntersecting;
          updateDock();
        },
        { threshold: 0.15 }
      ).observe(contact);
    }

    window.addEventListener("scroll", updateDock, { passive: true });
    updateDock();

    var dockForm = document.getElementById("dock-form");
    if (dockForm && contact) {
      dockForm.addEventListener("click", function (e) {
        e.preventDefault();
        contact.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          block: "start",
        });
        var firstField = contact.querySelector('input[name="contact"]');
        if (!firstField) return;
        window.setTimeout(function () {
          firstField.focus({ preventScroll: true });
        }, prefersReduced ? 0 : 700);
      });
    }
  }

  var form = document.getElementById("lead-form");
  if (!form) return;

  var statusEl = document.getElementById("lead-status");
  var submitBtn = document.getElementById("lead-submit");
  var fileInput = document.getElementById("lead-file");
  var fileNameEl = document.getElementById("lead-file-name");
  var endpoint = form.getAttribute("data-endpoint") || "/api/lead";
  var maxFileBytes = 10 * 1024 * 1024;
  var lang = document.documentElement.lang === "en" ? "en" : "ru";
  var msg = {
    ru: {
      fileHint: "Excel, PDF, CSV или архив — до 10 МБ",
      fileTooBig: "Файл слишком большой — максимум 10 МБ.",
      needContact: "Укажите контакт — Telegram, телефон или email.",
      needMessage: "Напишите сообщение или прикрепите файл отчёта.",
      sending: "Отправляем…",
      sent: "Заявка ушла в Telegram. Отвечу в ближайшее время.",
      failed: "Не удалось отправить. Напишите напрямую в Telegram @nicoIich.",
      offline: "Сервер формы недоступен. Напишите напрямую в Telegram @nicoIich.",
    },
    en: {
      fileHint: "Excel, PDF, CSV or archive — up to 10 MB",
      fileTooBig: "File is too large — maximum 10 MB.",
      needContact: "Please add a contact — Telegram, phone or email.",
      needMessage: "Write a message or attach a report file.",
      sending: "Sending…",
      sent: "Request sent to Telegram. I will reply shortly.",
      failed: "Could not send. Message @nicoIich on Telegram directly.",
      offline: "Form server unavailable. Message @nicoIich on Telegram directly.",
    },
  };
  var t = msg[lang];
  var defaultFileHint = t.fileHint;

  function setStatus(kind, text) {
    statusEl.hidden = false;
    statusEl.className = "lead-form__status is-" + kind;
    statusEl.textContent = text;
  }

  if (fileInput && fileNameEl) {
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) {
        fileNameEl.textContent = defaultFileHint;
        fileNameEl.classList.remove("is-chosen");
        return;
      }
      if (file.size > maxFileBytes) {
        setStatus("err", t.fileTooBig);
        fileInput.value = "";
        fileNameEl.textContent = defaultFileHint;
        fileNameEl.classList.remove("is-chosen");
        return;
      }
      fileNameEl.textContent = file.name + " (" + Math.ceil(file.size / 1024) + " КБ)";
      fileNameEl.classList.add("is-chosen");
      statusEl.hidden = true;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var contact = String(data.get("contact") || "").trim();
    var message = String(data.get("message") || "").trim();
    var file = fileInput && fileInput.files && fileInput.files[0];

    if (!contact) {
      setStatus("err", t.needContact);
      return;
    }
    if (!file && message.length < 5) {
      setStatus("err", t.needMessage);
      return;
    }
    if (file && file.size > maxFileBytes) {
      setStatus("err", t.fileTooBig);
      return;
    }

    submitBtn.disabled = true;
    setStatus("ok", t.sending);

    // multipart: не ставим Content-Type вручную — boundary задаст браузер
    fetch(endpoint, {
      method: "POST",
      body: data,
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (_ref) {
        if (_ref.res.ok && _ref.body && _ref.body.ok) {
          setStatus("ok", t.sent);
          form.reset();
          var firstTopic = form.querySelector('input[name="topic"][value="A"]');
          if (firstTopic) firstTopic.checked = true;
          if (fileNameEl) {
            fileNameEl.textContent = defaultFileHint;
            fileNameEl.classList.remove("is-chosen");
          }
          return;
        }
        var err = (_ref.body && _ref.body.error) || t.failed;
        setStatus("err", err);
      })
      .catch(function () {
        setStatus("err", t.offline);
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
