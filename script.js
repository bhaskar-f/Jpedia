const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const API_BASE =
  window.JINFO_API_BASE ||
  (window.location.port && window.location.port !== "3000"
    ? `http://${window.location.hostname}:3000/api`
    : `${window.location.origin}/api`);
const state = {
  data: null,
  saved: readStorage("jinfo_saved"),
  applications: readStorage("jinfo_apps"),
  alerts: readStorage("jinfo_alerts"),
  joined: readStorage("jinfo_communities"),
  apiAvailable: false,
  currentUser: null,
  returnTo: null,
  category: "all",
  query: "",
  jobResults: null,
};

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function store(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
async function apiResponse(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(
      result.error?.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    error.code = result.error?.code;
    throw error;
  }
  return result;
}
async function api(path, options = {}) {
  const result = await apiResponse(path, options);
  return result.data;
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function icon(name, className = "") {
  const paths = {
    shield:
      '<path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-5"/>',
    badge: '<circle cx="12" cy="9" r="6"/><path d="m8 14-1 8 5-3 5 3-1-8"/>',
    document: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 15c4-1 6 1 6 5"/>',
    building:
      '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1M9 14h1m4 0h1m-4 7v-4h2v4"/>',
    train:
      '<rect x="5" y="3" width="14" height="15" rx="2"/><path d="M8 21l2-3m6 3-2-3M8 7h8M8 12h.1M16 12h.1"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.1M4 12h.1M4 18h.1"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-3a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h3z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18m-11 0v2h4v-2"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.3 3.3-.7"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `icon ${className}`.trim());
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.innerHTML = paths[name] || paths.document;
  return svg;
}
function enhancePasswordInput(input) {
  if (input.dataset.passwordVisibilityReady === "true") return;
  input.dataset.passwordVisibilityReady = "true";
  input.classList.add("password-visibility-input");
  const wrapper = document.createElement("span");
  wrapper.className = "password-visibility-control";
  const parent = input.parentNode;
  if (!parent) return;
  parent.insertBefore(wrapper, input);
  wrapper.append(input);
  const toggle = document.createElement("button");
  toggle.className = "password-visibility-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Show password");
  toggle.setAttribute("title", "Show password");
  toggle.setAttribute("aria-pressed", "false");
  toggle.append(icon("eye"));
  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const label = show ? "Hide password" : "Show password";
    toggle.replaceChildren(icon(show ? "eyeOff" : "eye"));
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-pressed", String(show));
  });
  wrapper.append(toggle);
}
function enhancePasswordInputs(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
}
enhancePasswordInputs();
if (document.body && "MutationObserver" in window) {
  const passwordFieldObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        if (added.matches?.('input[type="password"]')) enhancePasswordInput(added);
        enhancePasswordInputs(added);
      }
    }
  });
  passwordFieldObserver.observe(document.body, { childList: true, subtree: true });
}
function jobById(id) {
  return state.data.jobs.find((job) => job.id === id);
}
function persist() {
  if (!state.currentUser) {
    store("jinfo_saved", state.saved);
    store("jinfo_apps", state.applications);
  }
  store("jinfo_alerts", state.alerts);
  updateCounts();
  renderTracker();
}
function updateCounts() {
  $("#savedCount").textContent = state.saved.length;
  $("#applicationCount").textContent = state.applications.length;
  $("#alertCount").textContent = state.alerts.length;
}
function showMessage(message) {
  let notice = $("#appNotice");
  if (!notice) {
    notice = node("div", "app-notice");
    notice.id = "appNotice";
    $("#modalContent").append(notice);
  }
  notice.textContent = message;
}
function friendlyAuthError(error) {
  const status = error.status;
  if (status === 0 || status >= 500)
    return "The service is unavailable right now. Please try again shortly.";
  const messages = {
    INVALID_CREDENTIALS: "Invalid email or password.",
    EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
    TOO_MANY_REQUESTS: "Too many attempts. Please wait a little and try again.",
    RATE_LIMITED: "Too many attempts. Please wait a little and try again.",
    OTP_RATE_LIMITED: "Too many OTP attempts. Please try again later.",
    OTP_NOT_CONFIGURED: "Mobile verification is not configured yet.",
    SMS_NOT_CONFIGURED: "Mobile verification is not configured yet.",
    INVALID_OR_EXPIRED_TOKEN: "This link is invalid or has expired.",
    INVALID_OTP: "That code is invalid or expired.",
    OTP_COOLDOWN: "Please wait before requesting another code.",
    OTP_PROVIDER_NOT_CONFIGURED:
      "Mobile verification is not available right now.",
    EMAIL_IN_USE: "An account with this email already exists.",
    EMAIL_NOT_VERIFIED: "Verify your email before signing in. You can resend the verification email below.",
    PHONE_IN_USE: "This mobile number is already linked to an account.",
  };
  return (
    messages[error.code] ||
    (status === 401
      ? "Please sign in again."
      : status === 429
        ? "Too many attempts. Please wait and try again."
        : "We could not complete that request. Check your details and try again.")
  );
}
async function authRequest(path, options) {
  try {
    return await api(path, options);
  } catch (error) {
    error.message = friendlyAuthError(error);
    throw error;
  }
}
function authField(form, labelText, name, type = "text", options = {}) {
  const wrapper = node("label", "auth-field");
  wrapper.append(node("span", "", labelText));
  const input = node("input");
  input.name = name;
  input.type = type;
  input.autocomplete = options.autocomplete || "off";
  input.required = options.required !== false;
  if (options.minLength) input.minLength = options.minLength;
  if (options.pattern) input.pattern = options.pattern;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.inputMode) input.inputMode = options.inputMode;
  if (options.maxLength) input.maxLength = options.maxLength;
  wrapper.append(input);
  form.append(wrapper);
  return input;
}
function normalizeIndianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (
    digits.length === 12 &&
    digits.startsWith("91") &&
    /^[6-9]/.test(digits.slice(2))
  )
    return `+91${digits.slice(2)}`;
  return null;
}
function setAuthButton(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}
function setCurrentUser(user) {
  state.currentUser = user || null;
  const button = $("#loginBtn");
  if (button) {
    const label = !user
      ? "Sign in / Register"
      : user.role === "USER"
        ? "Dashboard"
        : `${user.name || "Account"} · ${user.role || "USER"}`;
    if (
      document.body.classList.contains("home-page") ||
      document.body.classList.contains("public-mobile-shell")
    ) {
      button.replaceChildren(icon("account", "home-account-icon"), document.createTextNode(label));
      button.setAttribute("aria-label", label);
    } else {
      button.textContent = label;
    }
  }
}
function openLoginPrompt() {
  renderAuth("login");
  showMessage("Please sign in to continue.");
}
function renderAuth(mode = "login", options = {}) {
  const content = $("#modalContent");
  content.replaceChildren();
  const titles = {
    login: "Login to J-Info",
    register: "Create your J-Info account",
    forgot: "Forgot password?",
    otp: "Sign in with mobile OTP",
    reset: "Reset your password",
    verify: "Verify your email",
  };
  content.append(node("h2", "", titles[mode] || titles.login));
  const form = node("form", "auth-form");
  form.noValidate = true;
  const fields = {};
  if (mode === "register") {
    fields.name = authField(form, "Full Name", "name", "text", {
      autocomplete: "name",
      maxLength: 100,
    });
    fields.email = authField(form, "Email", "email", "email", {
      autocomplete: "email",
    });
    fields.phoneNumber = authField(
      form,
      "Mobile Number",
      "phoneNumber",
      "tel",
      {
        autocomplete: "tel",
        placeholder: "9876543210 or +91 9876543210",
        pattern: "[+0-9 ()-]{10,16}",
        inputMode: "tel",
      },
    );
    fields.phoneNumber.addEventListener("input", () =>
      fields.phoneNumber.setCustomValidity(
        normalizeIndianPhone(fields.phoneNumber.value)
          ? ""
          : "Enter a valid 10-digit Indian mobile number, optionally with +91.",
      ),
    );
    fields.password = authField(form, "Password", "password", "password", {
      autocomplete: "new-password",
      minLength: 10,
    });
    fields.confirmPassword = authField(
      form,
      "Confirm Password",
      "confirmPassword",
      "password",
      { autocomplete: "new-password", minLength: 10 },
    );
    fields.confirmPassword.addEventListener("input", () =>
      fields.confirmPassword.setCustomValidity(""),
    );
  } else if (mode === "login") {
    fields.email = authField(form, "Email", "email", "email", {
      autocomplete: "email",
    });
    fields.password = authField(form, "Password", "password", "password", {
      autocomplete: "current-password",
    });
  } else if (mode === "forgot")
    fields.email = authField(form, "Email", "email", "email", {
      autocomplete: "email",
    });
  else if (mode === "reset") {
    fields.password = authField(form, "New Password", "password", "password", {
      autocomplete: "new-password",
      minLength: 10,
    });
    fields.confirmPassword = authField(
      form,
      "Confirm Password",
      "confirmPassword",
      "password",
      { autocomplete: "new-password", minLength: 10 },
    );
    fields.confirmPassword.addEventListener("input", () =>
      fields.confirmPassword.setCustomValidity(""),
    );
  } else if (mode === "otp") {
    fields.phoneNumber = authField(
      form,
      "Indian mobile number",
      "phoneNumber",
      "tel",
      {
        autocomplete: "tel",
        placeholder: "9876543210 or +91 9876543210",
        pattern: "[+0-9 ()-]{10,16}",
        inputMode: "tel",
      },
    );
    fields.phoneNumber.addEventListener("input", () =>
      fields.phoneNumber.setCustomValidity(
        normalizeIndianPhone(fields.phoneNumber.value)
          ? ""
          : "Enter a valid 10-digit Indian mobile number, optionally with +91.",
      ),
    );
    if (options.otpStep === "verify") {
      fields.code = authField(form, "Verification code", "code", "text", {
        autocomplete: "one-time-code",
        inputMode: "numeric",
        pattern: "[0-9]{4,10}",
        maxLength: 10,
      });
      fields.name = authField(
        form,
        "Name (for a new account)",
        "name",
        "text",
        { autocomplete: "name", maxLength: 100, required: false },
      );
    }
  }
  if (mode === "verify") {
    content.append(
      node(
        "p",
        "",
        "Your account was created. Verify your email before signing in.",
      ),
    );
    const resendForm = node("form", "auth-form");
    fields.email = authField(resendForm, "Email", "email", "email", {
      autocomplete: "email",
    });
    const resend = node("button", "small-btn", "Resend verification email");
    resend.type = "submit";
    resend.dataset.label = resend.textContent;
    resendForm.append(resend);
    resendForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!resendForm.reportValidity()) return;
      setAuthButton(resend, true, "Sending...");
      try {
        await authRequest("/auth/resend-verification", {
          method: "POST",
          body: JSON.stringify({ email: fields.email.value.trim() }),
        });
        showMessage(
          "Request received. If your account needs verification, instructions will be sent.",
        );
      } catch (error) {
        if (mode === "login" && error.code === "EMAIL_NOT_VERIFIED") {
          renderAuth("verify");
          const verifyEmail = $("#modalContent input[name=email]");
          if (verifyEmail) verifyEmail.value = values.email.trim();
          showMessage(error.message);
          return;
        }
        showMessage(error.message);
      } finally {
        setAuthButton(resend, false);
      }
    });
    content.append(resendForm);
  }
  if (form.childElementCount) {
    const submit = node(
      "button",
      "small-btn",
      {
        login: "Sign In",
        register: "Create Account",
        forgot: "Send Reset Link",
        reset: "Reset Password",
        otp: options.otpStep === "verify" ? "Verify OTP" : "Send OTP",
      }[mode] || "Continue",
    );
    submit.type = "submit";
    submit.dataset.label = submit.textContent;
    form.append(submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      setAuthButton(
        submit,
        true,
        {
          login: "Signing in...",
          register: "Creating account...",
          forgot: "Sending...",
          reset: "Resetting...",
          otp: options.otpStep === "verify" ? "Verifying..." : "Sending OTP...",
        }[mode],
      );
      try {
        if (mode === "login") {
          const result = await authRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: values.email.trim(),
              password: values.password,
            }),
          });
          setCurrentUser(result.user);
          try {
            await syncPersonalState();
          } catch (error) {
            console.error("Could not load account data:", error.message);
          }
          $("#modalBackdrop").hidden = true;
          if (state.returnTo) {
            const destination = state.returnTo;
            state.returnTo = null;
            window.location.assign(destination);
            return;
          }
          renderJobs();
        }
        if (mode === "register") {
          if (values.password !== values.confirmPassword) {
            fields.confirmPassword.setCustomValidity("Passwords do not match.");
            fields.confirmPassword.reportValidity();
            return;
          }
          const phone = normalizeIndianPhone(values.phoneNumber);
          if (!phone) {
            showMessage(
              "Enter a valid 10-digit Indian mobile number, optionally with +91.",
            );
            return;
          }
          const result = await authRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: values.name.trim(),
              email: values.email.trim(),
              phoneNumber: phone,
              password: values.password,
            }),
          });
          if (result.verificationEmailSent) {
            renderAuth("verify");
            $("#modalContent").querySelector("input[name=email]").value =
              values.email.trim();
            showMessage(
              "Account created. Please verify your email before signing in.",
            );
          } else {
            renderAuth("verify");
            $("#modalContent").querySelector("input[name=email]").value =
              values.email.trim();
            showMessage(
              "Account created, but the verification email could not be sent. Check the server EMAIL_* configuration, then resend the verification email.",
            );
          }
        }
        if (mode === "forgot") {
          await authRequest("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email: values.email.trim() }),
          });
          showMessage(
            "If an account exists for this email, password reset instructions will be sent.",
          );
        }
        if (mode === "reset") {
          if (values.password !== values.confirmPassword) {
            fields.confirmPassword.setCustomValidity("Passwords do not match.");
            fields.confirmPassword.reportValidity();
            return;
          }
          await authRequest("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
              token: options.token,
              password: values.password,
            }),
          });
          renderAuth("login");
          showMessage("Password reset successfully.");
        }
        if (mode === "otp") {
          const phone = normalizeIndianPhone(values.phoneNumber);
          if (!phone) {
            showMessage(
              "Enter a valid 10-digit Indian mobile number, optionally with +91.",
            );
            return;
          }
          if (options.otpStep === "verify") {
            const result = await authRequest("/auth/verify-otp", {
              method: "POST",
              body: JSON.stringify({
                phoneNumber: phone,
                code: values.code,
                name: values.name || undefined,
              }),
            });
            if (result.user) {
              setCurrentUser(result.user);
              try {
                await syncPersonalState();
              } catch {}
              $("#modalBackdrop").hidden = true;
              renderJobs();
            } else showMessage("Mobile number verified.");
          } else {
            await authRequest("/auth/send-otp", {
              method: "POST",
              body: JSON.stringify({ phoneNumber: phone }),
            });
            renderAuth("otp", { otpStep: "verify", phoneNumber: phone });
            $("#modalContent").querySelector("[name=phoneNumber]").value =
              phone;
            showMessage("OTP sent. It may take a moment to arrive.");
          }
        }
      } catch (error) {
        showMessage(error.message);
      } finally {
        if (submit.isConnected) setAuthButton(submit, false);
      }
    });
    content.append(form);
  }
  const links = node("div", "auth-links");
  const link = (label, fn) => {
    const button = node("button", "", label);
    button.type = "button";
    button.addEventListener("click", fn);
    links.append(button);
  };
  if (mode === "login") {
    link("Create an account", () => renderAuth("register"));
    link("Forgot password?", () => renderAuth("forgot"));
    links.append(node("span", "auth-coming-soon", "Phone sign-in · Coming Soon"));
    const google = node("a", "", "Continue with Google");
    google.href = `${API_BASE}/auth/google`;
    google.addEventListener("click", () => {
      google.textContent = "Connecting to Google...";
      google.setAttribute("aria-disabled", "true");
    }, { once: true });
    links.append(google);
  } else if (mode === "otp") {
    if (options.otpStep === "verify") {
      let remaining = 60;
      const resend = node("button", "", "Resend OTP (60s)");
      resend.type = "button";
      resend.disabled = true;
      resend.addEventListener("click", async () => {
        try {
          await authRequest("/auth/send-otp", {
            method: "POST",
            body: JSON.stringify({ phoneNumber: options.phoneNumber }),
          });
          remaining = 60;
          resend.disabled = true;
          resend.textContent = "Resend OTP (60s)";
          const tick = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              clearInterval(tick);
              resend.disabled = false;
              resend.textContent = "Resend OTP";
            } else resend.textContent = `Resend OTP (${remaining}s)`;
          }, 1000);
        } catch (error) {
          showMessage(error.message);
        }
      });
      links.append(resend);
      const tick = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(tick);
          resend.disabled = false;
          resend.textContent = "Resend OTP";
        } else resend.textContent = `Resend OTP (${remaining}s)`;
      }, 1000);
    }
    link("Back to sign in", () => renderAuth("login"));
  } else if (mode !== "verify")
    link("Back to sign in", () => renderAuth("login"));
  if (links.childElementCount) content.append(links);
  $("#modalBackdrop").hidden = false;
  const focus = content.querySelector("input:not([type=hidden])");
  if (focus) focus.focus();
}
function renderPlaceholder(title) {
  const content = $("#modalContent");
  content.replaceChildren(
    node("h2", "", title),
    node("p", "", `${title} — Coming next.`),
  );
  const close = node("button", "small-btn", "Close");
  close.type = "button";
  close.addEventListener("click", closeModal);
  content.append(close);
  $("#modalBackdrop").hidden = false;
}
function renderAccountMenu() {
  const user = state.currentUser;
  if (!user) return renderAuth("login");
  if (user.role === "USER") {
    window.location.assign("/dashboard");
    return;
  }
  const content = $("#modalContent");
  content.replaceChildren(
    node("h2", "", "Your Account"),
    node("p", "", `${user.name} · ${user.email || user.phoneNumber || ""}`),
    node("p", "", `Role: ${user.role}`),
  );
  const actions = node("div", "auth-links");
  const add = (label, fn) => {
    const b = node("button", "", label);
    b.type = "button";
    b.addEventListener("click", fn);
    actions.append(b);
  };
  if (["ADMIN", "SUPER_ADMIN"].includes(user.role))
    add("Admin Dashboard", () => window.location.assign("/admin"));
  if (user.role === "AUTHOR")
    add("Author Dashboard", () => window.location.assign("/admin/jobs"));
  add("Logout", logout);
  content.append(actions);
  $("#modalBackdrop").hidden = false;
}
async function logout() {
  const button = $("#loginBtn");
  const action = [...$$("#modalContent button")].find(
    (item) => item.textContent === "Logout",
  );
  if (button) {
    button.disabled = true;
    button.textContent = "Signing out...";
  }
  if (action) {
    action.disabled = true;
    action.textContent = "Signing out...";
  }
  try {
    await authRequest("/auth/logout", { method: "POST" });
  } catch (error) {
    try {
      await authRequest("/auth/refresh", { method: "POST" });
      await authRequest("/auth/logout", { method: "POST" });
    } catch {
      setCurrentUser(null);
      showMessage("Your session has ended. Sign in again to continue.");
    }
  }
  state.currentUser = null;
  state.saved = readStorage("jinfo_saved");
  state.applications = readStorage("jinfo_apps");
  setCurrentUser(null);
  persist();
  renderJobs();
  closeModal();
  if (button) button.disabled = false;
}
async function syncPersonalState() {
  const aliases = {
    wbp: "wbp-constable",
    delhi: "delhi-police-si",
    phase: "ssc-phase-xv",
  };
  const localSaved = state.saved.map(
    (id) =>
      state.data.jobs.find((job) => job.id === id || job.legacyId === id)?.id ||
      aliases[id] ||
      id,
  );
  const localApps = state.applications.map((app) => ({
    ...app,
    id:
      state.data.jobs.find(
        (job) => job.id === app.id || job.legacyId === app.id,
      )?.id ||
      aliases[app.id] ||
      app.id,
  }));
  await api("/saved-jobs/sync", {
    method: "POST",
    body: JSON.stringify({ jobIds: localSaved }),
  });
  await api("/applications/sync", {
    method: "POST",
    body: JSON.stringify({ applications: localApps }),
  });
  const [saved, applications, preferences] = await Promise.all([
    api("/saved-jobs?limit=100"),
    api("/applications?limit=100"),
    api("/users/me/notification-preferences"),
  ]);
  state.saved = saved.map((item) =>
    String(item._id || item.job?._id || item.job),
  );
  state.applications = applications.map((item) => ({
    id: String(item.job?._id || item.job),
    applicationId: item._id,
    status: item.status === "APPLIED" ? "Applied" : item.status,
  }));
  if (state.alerts.length) {
    const user = await api("/users/me");
    const preferredExams = [
      ...new Set([...(user.preferredExams || []), ...state.alerts]),
    ];
    await api("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ preferredExams }),
    });
  }
  try {
    const memberships = await api("/communities/membership/me");
    state.joined = memberships.map((item) =>
      String(item.community?._id || item.community),
    );
  } catch {}
  const personal = await api("/notifications");
  state.data.notifications = personal.map((item) => ({
    id: String(item._id),
    label: item.type,
    text: `${item.title}${item.message ? ` — ${item.message}` : ""}`,
    jobId: item.relatedJob ? String(item.relatedJob) : undefined,
  }));
  state.notificationPreferences = preferences;
  updateCounts();
  renderTracker();
  renderCommunities();
  renderNotifications();
}
async function handleAuthLink() {
  const params = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const verificationToken = fragment.get("verifyEmail") || params.get("verifyEmail");
  const resetToken = fragment.get("resetPassword") || params.get("resetPassword");
  const oauth = params.get("auth");
  const returnTo = params.get("returnTo");
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    try {
      const destination = new URL(returnTo, window.location.origin);
      if (destination.origin === window.location.origin)
        state.returnTo = `${destination.pathname}${destination.search}${destination.hash}`;
    } catch {}
  }
  if (!verificationToken && !resetToken && !oauth) return false;
  history.replaceState({}, "", window.location.pathname);
  if (oauth === "login") {
    renderAuth("login");
    showMessage("Sign in to continue.");
    return true;
  }
  if (verificationToken) {
    try {
      await authRequest("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: verificationToken }),
      });
      renderAuth("login");
      showMessage("Verification successful. You can now sign in.");
    } catch (error) {
      renderAuth("verify");
      showMessage(
        "Verification failed or expired. Enter your email to request a new verification link.",
      );
    }
    return true;
  }
  if (resetToken) {
    renderAuth("reset", { token: resetToken });
    return true;
  }
  if (oauth === "failed") {
    renderAuth("login");
    showMessage("Google sign in could not be completed. Please try again.");
    return true;
  }
  if (oauth === "success") {
    try {
      const result = await authRequest("/users/me");
      setCurrentUser(result.user);
      try {
        await syncPersonalState();
      } catch {}
      renderJobs();
    } catch {
      renderAuth("login");
      showMessage(
        "Google sign in completed, but we could not load your account. Please try again.",
      );
    }
    return true;
  }
  return false;
}
function renderJobs() {
  const container = $("#jobList");
  container.replaceChildren();
  const query = state.query.trim().toLowerCase();
  const matches = (state.jobResults || state.data.jobs).filter((job) => {
    const haystack = [
      job.title,
      job.organization,
      job.category,
      job.board,
      job.boardName,
      job.location,
      job.qualification,
      ...job.tags,
    ]
      .join(" ")
      .toLowerCase();
    const categoryMatch =
      state.category === "all" ||
      job.category === state.category ||
      job.board === state.category ||
      job.tags.includes(state.category);
    return categoryMatch && (!query || haystack.includes(query));
  });
  matches.slice(0, 5).forEach((job) => {
    const card = node("article", "job-card");
    card.dataset.jobId = job.id;
    card.dataset.jobUrl = `/jobs/${encodeURIComponent(job.id)}`;
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `View ${job.title}`);
    const jobIcon = node("div", "job-icon");
    jobIcon.append(icon(job.icon));
    const info = node("div", "job-info");
    info.append(
      node("div", "job-name", job.title),
      node("div", "job-org", job.organization),
    );
    const actions = node("div", "job-actions");
    actions.append(node("span", "deadline", `Last Apply : ${job.deadline}`));
    const view = node("a", "small-btn details-btn", "More Info");
    view.href = card.dataset.jobUrl;
    actions.append(view);
    card.append(jobIcon, info, actions);
    container.append(card);
  });
  if (!matches.length)
    container.append(
      node(
        "p",
        "empty-tracker",
        "No jobs match your search. Try another term or board.",
      ),
    );
}
function renderCommunities() {
  const container = $("#communityTrack");
  container.replaceChildren();
  state.data.communities.forEach((community) => {
    const card = node("article", "community-card");
    const image = node("div", "community-icon");
    image.append(icon(community.icon));
    const title = node("a", "community-title-link", community.name);
    title.href = `/communities/${encodeURIComponent(community.slug || community.id)}`;
    const description = node("p", "", community.description);
    const join = node(
      "button",
      "small-btn join-btn",
      state.joined.includes(community.id) ? "Joined" : "Join",
    );
    join.dataset.communityId = community.id;
    card.append(image, title, description, join);
    container.append(card);
  });
}
function renderPreparation() {
  const container = $("#preparationList");
  container.replaceChildren();
  state.data.preparation.slice(0, 8).forEach((item) => {
    const card = node("button", "prep-card");
    card.type = "button";
    card.dataset.prep = item.id;
    if (item.url) card.dataset.url = item.url;
    const glyph = node("span", "prep-icon");
    glyph.append(icon(item.icon));
    card.append(
      glyph,
      node("strong", "", item.name),
      node("span", "", item.description),
    );
    container.append(card);
  });
}
function renderBoards() {
  const container = $("#boardsList");
  container.replaceChildren();
  state.data.boards.forEach((board) => {
    const button = node("a", "board-item");
    button.href = `/boards/${encodeURIComponent(board.slug)}`;
    const image = node("span");
    image.append(icon(board.icon));
    button.append(image, node("b", "", board.name));
    container.append(button);
  });
  if (!state.data.boards.length)
    container.append(node("p", "empty-tracker", "No active boards available."));
}
function boardFilterLabel(board) {
  const identity =
    `${board.slug} ${board.category || ""} ${board.name}`.toLowerCase();
  if (identity.includes("police")) return "Police";
  if (identity.includes("rrb") || identity.includes("railway"))
    return "Railway";
  return board.name;
}
function renderBoardFilters() {
  const container = $("#boardFilterButtons");
  container.replaceChildren();
  state.data.boards.forEach((board) => {
    const button = node("a", "filter-btn", boardFilterLabel(board));
    button.href = `/jobs?board=${encodeURIComponent(board.slug)}`;
    container.append(button);
  });
}
function mapApiJob(job) {
  const board = job.board && typeof job.board === "object" ? job.board : null;
  return {
    id: String(job._id),
    title: job.title,
    organization: job.organization,
    board: board?.slug || "",
    boardName: board?.name || job.boardName || "",
    category: job.category || "",
    tags: job.tags || [],
    location: job.location || "",
    qualification: job.qualification || "",
    icon: job.category === "police" ? "shield" : "document",
    deadline: job.applicationDeadline
      ? new Date(job.applicationDeadline).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "See official notice",
  };
}
async function loadBoardJobs(slug) {
  const container = $("#jobList");
  container.replaceChildren(node("p", "empty-tracker", "Loading jobs..."));
  try {
    const result = await api(
      `/jobs?board=${encodeURIComponent(slug)}&page=1&limit=60`,
    );
    state.jobResults = result.map(mapApiJob);
    renderJobs();
  } catch (error) {
    state.jobResults = [];
    container.replaceChildren(
      node(
        "p",
        "empty-tracker",
        "Unable to load jobs for this board right now.",
      ),
    );
  }
}
function renderNotifications() {
  const container = $("#notificationList");
  container.replaceChildren();
  state.data.notifications.slice(0, 5).forEach((notice) => {
    const row = node(notice.jobId ? "a" : "div", "update-line");
    if (notice.jobId) row.href = `/jobs/${encodeURIComponent(notice.jobId)}`;
    row.append(
      node("span", "update-type", notice.label),
      node("span", "", notice.text),
      node("span", "", "›"),
    );
    container.append(row);
  });
}
function renderFaqs() {
  const container = $("#faqList");
  container.replaceChildren();
  state.data.faqs.slice(0, 5).forEach((faq) => {
    const details = node("details");
    details.append(
      node("summary", "", faq.question),
      node("p", "", faq.answer),
    );
    container.append(details);
  });
}
function renderTracker() {
  const container = $("#trackerList");
  if (!container || !state.data) return;
  container.replaceChildren();
  if (!state.applications.length) {
    container.append(
      node("div", "empty-tracker", "No applications tracked yet."),
    );
    return;
  }
  container.append(
    node(
      "div",
      "empty-tracker",
      `${state.applications.length} application${state.applications.length === 1 ? "" : "s"} tracked. Open the tracker to review them.`,
    ),
  );
}
function openModal(jobId) {
  const job = jobById(jobId);
  if (!job) return;
  const content = $("#modalContent");
  content.replaceChildren();
  const heading = node("div", "modal-title");
  const image = node("span", "job-icon");
  image.append(icon(job.icon));
  heading.append(image, node("h2", "", job.title));
  content.append(
    heading,
    node(
      "div",
      "source",
      `${job.organization} · Verify details in the official notification before applying.`,
    ),
  );
  const fields = [
    ["Deadline", job.deadline],
    ["Status", job.status],
    ["Qualification", job.qualification],
    ["Age", job.age],
    ["Location", job.location],
    ["Source", job.source],
    ["Tags", job.tags.join(", ")],
  ];
  const grid = node("div", "detail-grid");
  fields.forEach(([label, value]) => {
    const cell = node("div", "detail-cell");
    cell.append(
      node("small", "", label.toUpperCase()),
      node("span", "", value),
    );
    grid.append(cell);
  });
  content.append(grid);
  const actions = node("div", "modal-actions");
  const save = node(
    "button",
    "",
    state.saved.includes(job.id) ? "Remove Saved Job" : "Save Job",
  );
  const track = node(
    "button",
    "",
    state.applications.some((app) => app.id === job.id)
      ? "Application Tracked"
      : "Track Application",
  );
  const official = node("a", "", "Official site");
  official.href = job.officialUrl;
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  if (!job.officialUrl) {
    official.removeAttribute("href");
    official.setAttribute("aria-disabled", "true");
  }
  actions.append(save, track, official);
  if (job.howToApplyYoutubeUrl) {
    const tutorial = node("a", "", "How to Apply video");
    tutorial.href = job.howToApplyYoutubeUrl;
    tutorial.target = "_blank";
    tutorial.rel = "noopener noreferrer";
    actions.append(tutorial);
  }
  content.append(
    actions,
    node(
      "div",
      "modal-note",
      "These are seed/demo details. Confirm current dates and eligibility in the official recruitment notice.",
    ),
  );
  save.addEventListener("click", async () => {
    if (!state.currentUser) {
      openLoginPrompt();
      return;
    }
    try {
      const saving = !state.saved.includes(job.id);
      await api(`/saved-jobs/${job.id}`, {
        method: saving ? "POST" : "DELETE",
      });
      state.saved = saving
        ? [...state.saved, job.id]
        : state.saved.filter((id) => id !== job.id);
      persist();
      openModal(job.id);
    } catch (error) {
      showMessage(friendlyAuthError(error));
    }
  });
  track.addEventListener("click", async () => {
    if (!state.currentUser) {
      openLoginPrompt();
      return;
    }
    try {
      if (!state.applications.some((app) => app.id === job.id)) {
        const saved = await api("/applications", {
          method: "POST",
          body: JSON.stringify({ job: job.id, status: "APPLIED" }),
        });
        state.applications.push({
          id: job.id,
          applicationId: saved._id,
          status: "Applied",
        });
      }
      persist();
      openModal(job.id);
    } catch (error) {
      showMessage(friendlyAuthError(error));
    }
  });
  $("#modalBackdrop").hidden = false;
  $("#modalClose").focus();
}
function closeModal() {
  $("#modalBackdrop").hidden = true;
}
function bindEvents() {
  $("#jobQuickSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#jobSearch").value.trim();
    window.location.assign(
      `/jobs${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
  });
  $$(".filter-row > .filter-btn").forEach((button) =>
    button.addEventListener("click", () => {
      $$(".filter-btn").forEach((filter) => filter.classList.remove("active"));
      button.classList.add("active");
      state.category = button.dataset.filter;
      if (state.category === "all") {
        state.jobResults = null;
        renderJobs();
      } else loadBoardJobs(state.category);
    }),
  );
  $("#jobList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-job-url]");
    if (!card || event.target.closest("a")) return;
    window.location.assign(card.dataset.jobUrl);
  });
  $("#jobList").addEventListener("keydown", (event) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches("[data-job-url]")
    ) {
      event.preventDefault();
      window.location.assign(event.target.dataset.jobUrl);
    }
  });
  $("#notificationList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-job-id]");
    if (button) openModal(button.dataset.jobId);
  });
  $("#communityTrack").addEventListener("click", async (event) => {
    const button = event.target.closest(".join-btn");
    if (!button) return;
    if (!state.currentUser) {
      openLoginPrompt();
      return;
    }
    const id = button.dataset.communityId;
    const joining = !state.joined.includes(id);
    try {
      await api(`/communities/${id}/join`, {
        method: joining ? "POST" : "DELETE",
      });
      state.joined = joining
        ? [...state.joined, id]
        : state.joined.filter((item) => item !== id);
      button.textContent = joining ? "Joined" : "Join";
    } catch (error) {
      showMessage(friendlyAuthError(error));
    }
  });
  $("#preparationList").addEventListener("click", (event) => {
    const card = event.target.closest(".prep-card");
    if (card) {
      $("#preparationList")
        .querySelectorAll(".prep-card")
        .forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
      if (card.dataset.url)
        window.open(card.dataset.url, "_blank", "noopener,noreferrer");
    }
  });
  $("#saveAlertBtn").addEventListener("click", saveAlert);
  $("#alertInterest").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveAlert();
  });
  $("#interestBtn").addEventListener("click", () => {
    const value = $("#interestInput").value.trim();
    if (value) {
      $("#alertInterest").value = value;
      $("#services").scrollIntoView({ behavior: "smooth" });
    }
  });
  async function saveAlert() {
    const value = $("#alertInterest").value.trim();
    if (!value) return;
    if (!state.currentUser) {
      openLoginPrompt();
      return;
    }
    try {
      const user = await api("/users/me");
      const preferredExams = [
        ...new Set([...(user.preferredExams || []), value]),
      ];
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ preferredExams }),
      });
      if (!state.alerts.includes(value)) state.alerts.push(value);
      $("#alertInterest").value = "";
      persist();
    } catch (error) {
      showMessage(friendlyAuthError(error));
    }
  }
  const checkEligibilityButton = $("#checkEligibility");
  if (checkEligibilityButton)
    checkEligibilityButton.addEventListener("click", checkEligibility);
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target === $("#modalBackdrop")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  $("#communityNext").addEventListener("click", () => moveCarousel(1));
  $("#communityPrev").addEventListener("click", () => moveCarousel(-1));
  $("#dashboardBtn").addEventListener("click", (event) => {
    if (!state.currentUser) {
      event.preventDefault();
      state.returnTo = "/dashboard";
      openLoginPrompt();
    }
  });
  $$("[data-scroll]").forEach((element) =>
    element.addEventListener("click", () =>
      document
        .getElementById(element.dataset.scroll)
        ?.scrollIntoView({ behavior: "smooth" }),
    ),
  );
  $("#loginBtn").addEventListener("click", () => {
    if (!state.currentUser) return renderAuth("login");
    if (state.currentUser.role === "USER") return window.location.assign("/dashboard");
    renderAccountMenu();
  });
  document.addEventListener("click", (event) => {
    const menu = document.querySelector(".services-menu");
    if (menu?.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const menu = document.querySelector(".services-menu");
      if (menu) menu.open = false;
    }
  });
}
let communityIndex = 0;
function moveCarousel(direction) {
  if (window.matchMedia("(max-width: 850px)").matches) return;
  const cards = $$(".community-card");
  const visible = window.matchMedia("(max-width: 700px)").matches ? 1 : 3;
  communityIndex = Math.max(
    0,
    Math.min(communityIndex + direction, cards.length - visible),
  );
  const step = cards[0]
    ? cards[0].getBoundingClientRect().width +
      parseFloat(getComputedStyle($("#communityTrack")).gap || 0)
    : 184;
  $("#communityTrack").style.transform =
    `translateX(-${communityIndex * step}px)`;
}
function checkEligibility() {
  const age = Number($("#ageInput").value);
  const education = $("#educationInput").value;
  const job = state.data.jobs.find(
    (item) => item.id === $("#eligibilityJob").value,
  );
  const result = $("#eligibilityResult");
  if (!age) {
    result.hidden = false;
    result.textContent = "Enter your age first.";
    return;
  }
  const [min, max] = (job?.age || "0–0").split(/[–-]/).map(Number);
  const required = job.qualification.toLowerCase();
  const educationLevel =
    education === "10th Pass"
      ? "10th"
      : education === "12th Pass"
        ? "12th"
        : "graduate";
  const educationOk = required.includes(educationLevel);
  result.hidden = false;
  result.textContent =
    age >= min && age <= max && educationOk
      ? "Basic criteria appear compatible with the sample details shown here."
      : "The selected profile does not match the sample basic criteria. Check the official notification for exact rules, relaxations and conditions.";
}
async function init() {
  try {
    state.data = await api("/bootstrap");
    state.apiAvailable = true;
    const aliases = {
      wbp: "wbp-constable",
      delhi: "delhi-police-si",
      phase: "ssc-phase-xv",
    };
    const mapId = (id) =>
      state.data.jobs.find(
        (job) =>
          job.id === id || job.legacyId === id || job.legacyId === aliases[id],
      )?.id ||
      aliases[id] ||
      id;
    state.saved = [...new Set(state.saved.map(mapId))];
    state.applications = state.applications.map((item) => ({
      ...item,
      id: mapId(item.id),
    }));
    state.jobResults = null;
    renderJobs();
    renderCommunities();
    renderPreparation();
    renderBoards();
    renderBoardFilters();
    renderNotifications();
    renderFaqs();
    updateCounts();
    renderTracker();
    bindEvents();
    const authLinkHandled = await handleAuthLink();
    if (state.apiAvailable && !authLinkHandled) {
      try {
        setCurrentUser((await api("/users/me")).user);
      } catch {
        try {
          await api("/auth/refresh", { method: "POST" });
          setCurrentUser((await api("/users/me")).user);
        } catch {
          setCurrentUser(null);
        }
      }
      if (state.currentUser) {
        try {
          await syncPersonalState();
        } catch (error) {
          console.error("Could not synchronize account data:", error.message);
        }
      }
    }
  } catch (error) {
    console.error(error);
    $("#jobList").textContent =
      "Content could not be loaded. Run this page from a local web server.";
  }
}
const backTopButton = $("#backTop");
if (backTopButton)
  backTopButton.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );

if (
  window.location.pathname === "/" ||
  window.location.pathname === "/index.html"
) {
  document.body.classList.add("home-page");
  const account = $("#loginBtn");
  if (account) {
    account.replaceChildren(icon("account", "home-account-icon"), document.createTextNode("Sign in / Register"));
    account.setAttribute("aria-label", "Sign in / Register");
  }
  const mobileNav = $("#mobileBottomNav");
  if (mobileNav) {
    const links = [
      ["Home", "/", "home"],
      ["Jobs", "/jobs", "work"],
      ["Community", "/communities", "people"],
      ["Services", "/services", "list"],
    ];
    mobileNav.replaceChildren(
      ...links.map(([label, href, symbol], index) => {
        const link = node("a", `mobile-bottom-nav-link${index === 0 ? " is-active" : ""}`);
        link.href = href;
        if (index === 0) link.setAttribute("aria-current", "page");
        link.append(icon(symbol), node("span", "", label));
        return link;
      }),
    );
  }
  init();
} else if (/^\/(jobs|boards)\//.test(window.location.pathname)) {
  const account = $("#loginBtn");
  if (account) {
    const setAccountLabel = (label) => {
      if (document.body.classList.contains("job-details-shell")) {
        account.replaceChildren(
          icon("account", "home-account-icon"),
          document.createTextNode(label),
        );
        account.setAttribute("aria-label", label);
      } else {
        account.textContent = label;
      }
    };
    account.addEventListener("click", async () => {
      let user = null;
      try {
        user = (await api("/users/me")).user;
      } catch {}
      if (!user) {
        window.location.assign(
          `/?auth=login&returnTo=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      window.location.assign(
        user.role === "USER"
          ? "/dashboard"
          : user.role === "AUTHOR"
            ? "/admin/jobs"
            : "/admin",
      );
    });
    api("/users/me")
      .then((result) => {
        const user = result.user;
        setAccountLabel(
          user.role === "USER"
            ? "Dashboard"
            : `${user.name || "Account"} · ${user.role}`,
        );
      })
      .catch(() => {
        setAccountLabel("Sign in");
      });
  }
  document.addEventListener("click", (event) => {
    const menu = document.querySelector(".services-menu");
    if (menu?.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const menu = document.querySelector(".services-menu");
      if (menu) menu.open = false;
    }
  });
}
