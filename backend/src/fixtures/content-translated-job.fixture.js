// Temporary, in-memory fixture for stored job-content translation tests.
// This module creates data only; it never saves records or contacts a database.
const baseJob = {
  _id: '64b000000000000000000123',
  title: 'Junior Engineer Recruitment 2026',
  slug: 'junior-engineer-recruitment-2026-fixture',
  organization: 'National Public Works Board',
  boardName: 'National Public Works Board',
  description: 'Candidates with an engineering diploma may apply through the official portal.',
  vacancyCount: 240,
  applicationStartDate: '2026-11-01T00:00:00.000Z',
  applicationDeadline: '2026-12-15T23:59:59.000Z',
  applicationFee: '₹100 for General and OBC candidates; exempt for SC, ST, and women candidates.',
  salary: '₹35,400–₹1,12,400 per month',
  salaryInfo: {
    payLevel: 'Level 6',
    minimum: '₹35,400',
    maximum: '₹1,12,400',
    description: 'The selected candidates receive pay under Level 6, along with admissible allowances.',
  },
  officialApplyUrl: 'https://recruitment.example.gov.in/junior-engineer/apply',
  qualification: 'Diploma in Civil, Electrical, or Mechanical Engineering from a recognized institution.',
  ageRelaxation: 'Relaxation is available to eligible reserved categories as specified in the notice.',
  howToApplySteps: [
    'Register with a valid email address and mobile number.',
    'Complete the application form and submit it before the deadline.',
  ],
  importantDates: [
    { event: 'Applications open', date: '2026-11-01T00:00:00.000Z', description: 'The application portal opens at 10:00 AM.' },
    { event: 'Last date to apply', date: '2026-12-15T23:59:59.000Z', description: 'Submit the completed form before the portal closes.' },
  ],
  contentDocument: [
    { type: 'h2', attrs: { id: 'heading-preview-guidance' }, content: [{ type: 'span', translationKey: '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1', text: 'Application guidance' }] },
    { type: 'p', content: [{ type: 'span', text: 'This English-only paragraph has no stored translation.' }] },
    { type: 'p', content: [{ type: 'span', text: 'Use the ' }, { type: 'a', attrs: { href: 'https://recruitment.example.gov.in/notice.pdf' }, content: [{ type: 'span', translationKey: '619429fe-6e5b-4f1b-9241-61b267453f52', text: 'official notification' }] }, { type: 'span', text: ' for complete details.' }] },
    { type: 'table', content: [{ type: 'tbody', content: [{ type: 'tr', content: [{ type: 'th', content: [{ type: 'span', text: 'Vacancies' }] }, { type: 'td', content: [{ type: 'span', text: '240' }] }] }] }] },
  ],
  contentTranslations: {
    hi: {
      description: 'मान्यता प्राप्त संस्थान से इंजीनियरिंग डिप्लोमा वाले उम्मीदवार आधिकारिक पोर्टल से आवेदन कर सकते हैं।',
      qualification: 'सिविल, इलेक्ट्रिकल या मैकेनिकल इंजीनियरिंग में डिप्लोमा आवश्यक है।',
      ageRelaxation: 'पात्र आरक्षित श्रेणियों को अधिसूचना के अनुसार आयु में छूट मिलेगी।',
      howToApplySteps: [
        'मान्य ईमेल पते और मोबाइल नंबर से पंजीकरण करें।',
        'आवेदन पत्र पूरा करके अंतिम तिथि से पहले जमा करें।',
      ],
      importantDates: [
        { description: 'आवेदन पोर्टल सुबह 10:00 बजे खुलेगा।' },
        { description: 'पोर्टल बंद होने से पहले पूरा आवेदन जमा करें।' },
      ],
      contentDocument: {
        '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1': 'आवेदन संबंधी मार्गदर्शन',
        '619429fe-6e5b-4f1b-9241-61b267453f52': 'आधिकारिक अधिसूचना',
      },
    },
    bn: {
      description: 'স্বীকৃত প্রতিষ্ঠান থেকে ইঞ্জিনিয়ারিং ডিপ্লোমা থাকা প্রার্থীরা সরকারি পোর্টালে আবেদন করতে পারেন।',
      qualification: 'সিভিল, ইলেকট্রিক্যাল বা মেকানিক্যাল ইঞ্জিনিয়ারিংয়ে ডিপ্লোমা প্রয়োজন।',
      howToApplySteps: [
        'বৈধ ইমেল ঠিকানা ও মোবাইল নম্বর দিয়ে নিবন্ধন করুন।',
        'আবেদনপত্র পূরণ করে শেষ তারিখের আগে জমা দিন।',
      ],
      importantDates: [
        { description: 'আবেদন পোর্টাল সকাল ১০টায় খুলবে।' },
        { description: 'পোর্টাল বন্ধ হওয়ার আগে সম্পূর্ণ আবেদন জমা দিন।' },
      ],
      salaryInfo: {
        description: 'নির্বাচিত প্রার্থীরা প্রযোজ্য ভাতাসহ লেভেল ৬ অনুযায়ী বেতন পাবেন।',
      },
      contentDocument: {
        '8b18ebd2-e9ee-4f0d-995c-48f9e10506a1': 'আবেদনের নির্দেশিকা',
        '619429fe-6e5b-4f1b-9241-61b267453f52': 'সরকারি বিজ্ঞপ্তি',
      },
    },
  },
};

const clone = value => structuredClone(value);

function translatedJob(overrides = {}) {
  return {
    ...clone(baseJob),
    ...clone(overrides),
    contentTranslations: overrides.contentTranslations === undefined
      ? clone(baseJob.contentTranslations)
      : clone(overrides.contentTranslations),
  };
}

function hindiOnlyJob() {
  const job = translatedJob();
  delete job.contentTranslations.bn;
  return job;
}

function bengaliOnlyJob() {
  const job = translatedJob();
  delete job.contentTranslations.hi;
  return job;
}

function untranslatedJob() {
  const job = translatedJob();
  delete job.contentTranslations;
  return job;
}

const fixture = Object.freeze({ translatedJob, hindiOnlyJob, bengaliOnlyJob, untranslatedJob });

if (typeof module !== 'undefined' && module.exports) module.exports = fixture;
if (typeof window !== 'undefined') window.SetBGetTranslationPreviewFixture = fixture;
