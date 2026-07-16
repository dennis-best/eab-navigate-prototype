(function () {
  const SCENARIOS = [
    {
      id: "staff-home",
      name: "Staff Home",
      url: "navigate-app.html",
      description:
        "Navigate360 staff experience at Woodley College. Jack Whitmore reviews his Staff Home — assigned students, appointments, queues, and requests — then drills into the James Wyatt student profile.",
      steps: [
        "Land on Staff Home (Assigned Students tab).",
        "Open the Appointments tab and browse upcoming and recent appointments.",
        "Search for James Wyatt and open his student profile.",
        "Explore Overview, History, Courses, Journeys, and other profile tabs.",
      ],
    },
    {
      id: "advisor-101",
      name: "Advisor 101",
      url: "navigate-app.html?view=advisor-101",
      description:
        "Staff Story 1: a day-in-the-life advisor workflow — reviewing assigned students, using the Staff Assistant, filing an appointment summary, and checking the dashboard.",
      steps: [
        "Land on Staff Home with Michael Adams in Assigned Students.",
        "Click Adam, Michael to open his student profile.",
        "Open the Staff Assistant from the top navigation.",
        "Return to Staff Home → Appointments → Report Details on Peggy Aguila's row.",
        "Start Transcription, accept consent, and review the live transcript.",
        "Open Dashboard from the left navigation rail.",
      ],
    },
    {
      id: "staff-powered-alerts",
      name: "Staff Powered Alerts",
      url: "navigate-app.html?view=staff-powered-alerts",
      description:
        "Staff Story 2: a faculty member files a progress report, issues an alert, and staff manage the resulting case through resolution.",
      steps: [
        "Land on Professor Home.",
        "Fill Out Progress Reports → submit feedback for James Baydal.",
        "Go Home to Staff Home → Issue an Alert from the sidebar.",
        "Open Cases from the left rail → Case 514.",
        "Edit Details in the case drawer, then close the case.",
      ],
    },
    {
      id: "ai-automated-alerts",
      name: "AI Automated Alerts",
      url: "navigate-app.html?view=ai-automated-alerts",
      description:
        "Staff Story 3: use AI Report Finder to build a saved report, launch a messaging campaign with the AI Campaign Agent, and wire it into a report automation.",
      steps: [
        "Land on Dashboard.",
        "Open Reporting from the left rail → + Report Finder.",
        "Open Students Report with the suggested filters → Save as New Report.",
        "Go to Campaigns → Messaging Add New → Configure Outreach (enable AI Campaign Agent).",
        "Edit the SMS welcome nudge → Launch campaign.",
        "Return to Reports → My Report Automations → New Automation → save.",
        "View the campaign summary (empty, then the example with data).",
      ],
    },
    {
      id: "campaign-overview",
      name: "Campaign Overview",
      url: "navigate-app.html?view=campaigns",
      description:
        "Staff Story 4: browse Campaigns & Events, create an enrollment campaign, compose email and SMS nudges, and review campaign performance.",
      steps: [
        "Land on Campaigns & Events (or open it from the left rail).",
        "Choose Enrollment Campaigns under Student Campaigns.",
        "Open the active campaign row or start the campaign wizard.",
        "Walk through Define Campaign, Verify Recipients, Compose Nudges, and Verify & Start.",
        "Open the campaign detail page to review stats and nudge metrics.",
      ],
    },
    {
      id: "student-onboarding",
      name: "Student Onboarding",
      url: "student-onboarding.html",
      description:
        "Demo Student 1: a new student completes the intake survey on first login, then lands on the Account page in the student portal.",
      steps: [
        "Land on the Intake Survey dialog (opens automatically).",
        "Advance through all four survey steps.",
        "Close the survey to reveal the sidebar and Account page.",
        "Use Retake Intake Survey on the Account page if needed.",
      ],
    },
    {
      id: "student-generated-alerts",
      name: "Student Generated Alerts",
      url: "student-onboarding.html?login=pulse-check",
      description:
        "Demo Student 2: James Wyatt logs in, completes a pulse-check survey, and submits a self-alert through the Help drawer.",
      steps: [
        "Land on the Navigate360 login screen for James Wyatt.",
        "Log in and complete the Quick Check In (Pulse Check) survey.",
        "Open Surveys in the sidebar to view the completed survey.",
        "Open Help → I Need Support and submit a self-alert.",
        "Review previous submissions under Documents → I Need Support.",
      ],
    },
    {
      id: "application-management",
      name: "Application Management",
      url: "application-management.html",
      description:
        "Enrollment Story 2: Katy Chew uses the applicant portal to manage applications, complete configured forms, upload documents, and handle recommendation letters.",
      steps: [
        "Land on Applicant Portal Home with active applications.",
        "Open the General Application hub (hub-and-spoke section list).",
        "Complete Personal Background (try the conditional mailing-address logic).",
        "Upload documents and open a To-Do detail drawer.",
        "Request recommendation letters and open the external recommender accept page.",
      ],
    },
  ];

  function getCurrentScenarioId() {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);

    if (path.includes("student-onboarding")) {
      return params.get("login") === "pulse-check"
        ? "student-generated-alerts"
        : "student-onboarding";
    }
    if (path.includes("application-management")) {
      return "application-management";
    }
    if (path.includes("navigate-app")) {
      const view = params.get("view");
      if (view === "campaigns") return "campaign-overview";
      if (view === "advisor-101") return "advisor-101";
      if (view === "staff-powered-alerts") return "staff-powered-alerts";
      if (view === "ai-automated-alerts") return "ai-automated-alerts";
      return "staff-home";
    }
    return null;
  }

  function resolveScenarioUrl(url) {
    const inDemosFolder = /\/demos\/[^/]*$/.test(pathnameWithFile());
    if (inDemosFolder) return url;
    return "demos/" + url;
  }

  function pathnameWithFile() {
    if (location.pathname.endsWith("/")) return location.pathname + "index.html";
    return location.pathname;
  }

  function closeAllMenus() {
    if (window.EAB_closeDemoMenus) {
      window.EAB_closeDemoMenus();
      return;
    }
    document.querySelectorAll(".demo-menu__panel").forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll(".demo-menu__toggle").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function openDialog(scenario) {
    const dialog = document.getElementById("scenario-dialog");
    if (!dialog) return;

    dialog.querySelector(".scenario-dialog__title").textContent = scenario.name;
    dialog.querySelector(".scenario-dialog__desc").textContent = scenario.description;

    const stepsEl = dialog.querySelector(".scenario-dialog__steps");
    stepsEl.innerHTML = "";
    scenario.steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      stepsEl.appendChild(li);
    });

    dialog.dataset.targetUrl = resolveScenarioUrl(scenario.url);
    dialog.hidden = false;
    document.body.style.overflow = "hidden";
    dialog.querySelector(".scenario-dialog__btn--go").focus();
  }

  function closeDialog() {
    const dialog = document.getElementById("scenario-dialog");
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.style.overflow = "";
  }

  function populateMenu() {
    const list = document.getElementById("scenarios-menu-list");
    if (!list) return;

    const currentId = getCurrentScenarioId();
    list.innerHTML = "";

    SCENARIOS.forEach((scenario) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenarios-menu-item";
      const isCurrent = scenario.id === currentId;
      if (isCurrent) btn.classList.add("scenarios-menu-item--current");
      btn.textContent = isCurrent ? scenario.name + " — current" : scenario.name;
      btn.addEventListener("click", () => {
        closeAllMenus();
        openDialog(scenario);
      });
      list.appendChild(btn);
    });
  }

  function initDialog() {
    let dialog = document.getElementById("scenario-dialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "scenario-dialog";
      dialog.className = "unset scenario-dialog";
      dialog.hidden = true;
      dialog.innerHTML =
        '<div class="scenario-dialog__backdrop" data-action="cancel"></div>' +
        '<div class="scenario-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="scenario-dialog-title">' +
        '<h2 class="scenario-dialog__title" id="scenario-dialog-title"></h2>' +
        '<p class="scenario-dialog__desc"></p>' +
        '<ul class="scenario-dialog__steps"></ul>' +
        '<div class="scenario-dialog__actions">' +
        '<button type="button" class="scenario-dialog__btn scenario-dialog__btn--cancel" data-action="cancel">Cancel</button>' +
        '<button type="button" class="scenario-dialog__btn scenario-dialog__btn--go" data-action="go">Go!</button>' +
        "</div></div>";
      document.body.appendChild(dialog);
    }

    dialog.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "cancel") {
        closeDialog();
      } else if (action.dataset.action === "go") {
        const url = dialog.dataset.targetUrl;
        if (url) location.href = url;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDialog();
    });
  }

  function initIndexDescriptions() {
    SCENARIOS.forEach((scenario) => {
      const cell = document.querySelector(
        '[data-scenario-desc="' + scenario.id + '"]'
      );
      if (cell) cell.textContent = scenario.description;
    });
  }

  function init() {
    initDialog();
    populateMenu();
    initIndexDescriptions();
  }

  window.EAB_SCENARIOS = SCENARIOS;
  window.EAB_getCurrentScenarioId = getCurrentScenarioId;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
