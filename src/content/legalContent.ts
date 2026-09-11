export type LegalSection = { title: string; paragraphs: string[] };

export type LegalDocument = {
  pageTitle: string;
  effectiveDate: string;
  intro?: string;
  sections: LegalSection[];
  contactLines: string[];
};

export const privacyPolicy: LegalDocument = {
  pageTitle: "Privacy Policy",
  effectiveDate: "June 26, 2026",
  intro:
    "This Privacy Policy explains how Circle Prospecting AI collects, uses, discloses, and protects personal information when you use our website and services.",
  sections: [
    {
      title: "1. Information We Collect",
      paragraphs: [
        "We collect information you provide directly, including your name, email, phone number, brokerage, billing information, property and listing information, campaign details, and customer support communications.",
        "We also collect technical information such as IP address, browser type, cookies, and website usage.",
      ],
    },
    {
      title: "2. How We Use Information",
      paragraphs: [
        "We use information to provide services, process payments, manage campaigns, communicate with customers, improve our platform, comply with legal obligations, and protect against fraud.",
      ],
    },
    {
      title: "3. AI, Calling, SMS & Prospecting",
      paragraphs: [
        "Our services include AI-assisted calling, live callers, SMS, email marketing, CRM automation, and prospecting campaigns. Customers are responsible for compliance with TCPA, CAN-SPAM, DNC, and applicable laws.",
      ],
    },
    {
      title: "4. Sharing Information",
      paragraphs: [
        "We may share information with payment processors, CRM providers, dialers, hosting providers, analytics providers, data providers, and legal authorities when required.",
      ],
    },
    {
      title: "5. Data Security",
      paragraphs: [
        "We use commercially reasonable safeguards but cannot guarantee absolute security.",
      ],
    },
    {
      title: "6. Privacy Rights",
      paragraphs: [
        "Depending on your location, you may request access, correction, deletion, or other rights regarding your personal information.",
      ],
    },
  ],
  contactLines: [
    "Circle Prospecting AI",
    "https://circleprospecting.ai",
    "support@circleprospecting.ai",
    "(877) 359-1666",
  ],
};

export const termsAndConditions: LegalDocument = {
  pageTitle: "Terms & Conditions",
  effectiveDate: "June 26, 2026",
  sections: [
    {
      title: "1. Acceptance",
      paragraphs: ["By using Circle Prospecting AI, you agree to these Terms."],
    },
    {
      title: "2. Services",
      paragraphs: [
        "We provide AI-powered real estate prospecting, calling, SMS, email, virtual assistant, and marketing services.",
      ],
    },
    {
      title: "3. Customer Responsibilities",
      paragraphs: [
        "Customers must comply with all applicable laws including TCPA, CAN-SPAM, DNC, and real estate regulations.",
      ],
    },
    {
      title: "4. Payments",
      paragraphs: [
        "Fees are due according to your selected plan. Setup fees, data purchases, and completed services are generally non-refundable unless otherwise agreed in writing.",
      ],
    },
    {
      title: "5. Intellectual Property",
      paragraphs: [
        "All software, branding, content, and materials remain the property of Circle Prospecting AI.",
      ],
    },
    {
      title: "6. Disclaimer",
      paragraphs: [
        "Services are provided \"AS IS\" without guarantees of leads, appointments, listings, or revenue.",
      ],
    },
    {
      title: "7. Limitation of Liability",
      paragraphs: [
        "Our liability is limited to the amount paid for services as permitted by law.",
      ],
    },
    {
      title: "8. Governing Law",
      paragraphs: ["These Terms are governed by the laws of the State of Florida."],
    },
  ],
  contactLines: [
    "Circle Prospecting AI",
    "https://circleprospecting.ai",
    "support@circleprospecting.ai",
    "(877) 359-1666",
  ],
};
