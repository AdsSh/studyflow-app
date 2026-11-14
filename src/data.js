/* ==========================================================================
   StudyFlow — data, state and calculations
   ========================================================================== */
'use strict';

const $ = (selector, root) => (root || document).querySelector(selector);
const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

const STORE_KEY = 'studyflow.v1';
const TIMER_KEY = 'studyflow.timer.v1';
const RECOVERY_PREFIX = 'studyflow.v1.recovery.';
const MAX_RECOVERY_COPIES = 3;
const APP_VERSION = '1.0.0';
let recoveryKey = '';
let saveFailureReason = '';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SECTIONS = [
  { id: 'A', name: 'Management information', short: 'Management info', weight: 15 },
  { id: 'B', name: 'Accounting for cost elements', short: 'Cost elements', weight: 10 },
  { id: 'C', name: 'Costing methods & techniques', short: 'Costing methods', weight: 20 },
  { id: 'D', name: 'Forecasting, budgeting & control', short: 'Budgeting', weight: 20 },
  { id: 'E', name: 'Standard costing & variance analysis', short: 'Variances', weight: 15 },
  { id: 'F', name: 'Performance measurement', short: 'Performance', weight: 20 }
];

const CHAPTERS = [
  { no: 1, section: 'A', title: 'Management information', topics: ['Data vs information', 'Qualities of good information', 'Planning, control & decision making', 'Strategic, tactical & operational planning', 'Roles of the management accountant'] },
  { no: 2, section: 'A', title: 'Management information systems', topics: ['Role of information systems', 'Limitations of management information', 'Internal & external sources', 'Published data & internet sources'] },
  { no: 3, section: 'A', title: 'Spreadsheets', topics: ['Features & uses of spreadsheets', 'Data analysis functions', 'Cost & management accounting models'] },
  { no: 4, section: 'A', title: 'Big data & data analytics', topics: ['Big data characteristics', 'The big data pyramid', 'Data mining: benefits & risks', 'Analytics technologies'] },
  { no: 5, section: 'B', title: 'Cost classification & estimation', topics: ['Fixed, variable & semi-variable costs', 'Direct vs indirect; product vs period', 'Cost codification', 'High-low method', 'Regression & correlation'] },
  { no: 6, section: 'B', title: 'Accounting for inventory', topics: ['Procurement & documentation', 'Valuation: FIFO, LIFO, AVCO', 'EOQ & quantity discounts', 'Just-in-time systems'] },
  { no: 7, section: 'B', title: 'Accounting for labour', topics: ['Recording & monitoring labour', 'Remuneration methods', 'Incentive schemes', 'Labour turnover & payroll'] },
  { no: 8, section: 'B', title: 'Accounting for overheads', topics: ['Allocation, apportionment & absorption', 'Reciprocal apportionment', 'Under & over absorption', 'Activity-based costing'] },
  { no: 9, section: 'C', title: 'Costing methods', topics: ['Job costing', 'Batch costing', 'Process costing & losses', 'Equivalent units & WIP', 'Joint & by-products', 'Service costing'] },
  { no: 10, section: 'C', title: 'Costing techniques', topics: ['Marginal vs absorption costing', 'Profit statements', 'Reconciliation of profits'] },
  { no: 11, section: 'C', title: 'Cost control & cost reduction', topics: ['Control vs reduction', 'Value analysis & engineering', 'Work study & O&M'] },
  { no: 12, section: 'D', title: 'Forecasting & time series', topics: ['Forecasting methods', 'Time series components', 'Moving averages & seasonal variation', 'Line of best fit'] },
  { no: 13, section: 'D', title: 'Budgeting', topics: ['Budgeting framework', 'Principal budget factor', 'Functional budgets', 'Cash & master budgets'] },
  { no: 14, section: 'E', title: 'Standard costing & variances', topics: ['Standard cost cards', 'Material variances', 'Labour & overhead variances', 'Sales variances & reconciliation'] },
  { no: 15, section: 'F', title: 'Cost-volume-profit analysis', topics: ['Contribution & break-even', 'Margin of safety', 'Target profit', 'Break-even & PV charts'] },
  { no: 16, section: 'F', title: 'Relevant cost analysis', topics: ['Relevant vs irrelevant costs', 'Opportunity cost & pricing', 'Decision scenarios'] },
  { no: 17, section: 'F', title: 'Limiting factors', topics: ['Contribution per limiting factor', 'Optimal production plans', 'Make-or-buy decisions', 'Shutdown decisions'] }
];

const CORPORATE_LAW_CHAPTERS = [
  {
    "no": 1,
    "title": "The Nigerian legal system",
    "topics": [
      "Law and its sources",
      "Sources of Nigerian law",
      "Common law",
      "Doctrines of equity",
      "Statutes of general application (SOGA)",
      "Nigerian legislation",
      "Customary law",
      "Judicial precedent or case law",
      "Hierarchy of courts",
      "International law",
      "Legislative process",
      "Division of legislative powers between the Federal Government and State Government",
      "Distinctions between criminal law and civil law",
      "The application of virtual evidence in the Nigerian judicial system",
      "The governing principles of the Nigerian Data Protection Regulation, 2019",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 2,
    "title": "Company law",
    "topics": [
      "Types of Business Organisation",
      "Registration of business name",
      "Distinction between a partnership and a company",
      "Company",
      "The Corporate Affairs Commission",
      "Administrative proceedings committee (administrative committee)",
      "Functional classification of companies",
      "Private company",
      "Public company",
      "Small company",
      "Promoters",
      "Pre-incorporation contract",
      "Procedure for formation of a company",
      "Documents of incorporation (Sections 36-40, CAMA)",
      "Registration and grounds upon which the CAC may refuse to register the documents of a proposed company",
      "Consequences of incorporation",
      "Lifting the veil of incorporation",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 3,
    "title": "Flotation and management of a company",
    "topics": [
      "Exercise of management powers",
      "The powers of the board of directors",
      "The powers of the general meeting",
      "Meetings of a company and notices of meeting",
      "Types of meeting",
      "Annual returns of companies",
      "Appointment, status and duties of company directors",
      "Company audit",
      "Company capital and securities",
      "Maintenance of capital",
      "The rule against payment of dividends out of capital",
      "The rule on acquisition of own share by a company or share buy back",
      "Debentures",
      "Winding up of a company",
      "Administration of companies",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 4,
    "title": "Insolvency law",
    "topics": [
      "Meaning and types of insolvency",
      "Receivership",
      "Schemes of arrangement, compromise, and netting",
      "Fixed and floating charge",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 5,
    "title": "Criminal law",
    "topics": [
      "Criminal law, ethics and ethical codes",
      "Elements common to sections 98 and 116 of the Criminal Code",
      "Money laundering",
      "Electronic evidence",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 6,
    "title": "Law of contract",
    "topics": [
      "Definition and elements of a contract",
      "Privity of contract",
      "Terms of contract",
      "Exemption clauses in contract",
      "Vitiating elements in a contract",
      "Discharge of contract",
      "Remedies for breach of contract",
      "E-contract",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 7,
    "title": "Agency",
    "topics": [
      "Effects of agency",
      "Agency distinguished from other similar relationships",
      "Capacity",
      "Classes of agent",
      "Creation of agency",
      "Forms of authority",
      "Rights and duties of parties in agency relationship",
      "Effects of contracts made by the agents",
      "Termination of agency",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 8,
    "title": "Law of torts",
    "topics": [
      "Classification of torts",
      "Capacity in torts",
      "Forms of liability in torts",
      "Negligence",
      "Product liability",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 9,
    "title": "Sale of goods",
    "topics": [
      "Goods defined",
      "Sale of goods distinguished from other forms of contract",
      "Elements of sale of goods contract",
      "Transfer of property",
      "Property and possession",
      "Reservation of right of disposal",
      "Consequences of sale",
      "Transfer of title",
      "Performance of the contract",
      "Rights of a seller",
      "Rights of a buyer",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 10,
    "title": "Hire purchase",
    "topics": [
      "Nature of hire purchase",
      "Elements of a hire purchase agreement",
      "Passing of ownership",
      "Relevant proportion principle",
      "Duties and rights of parties to a hire purchase contract",
      "The third party in a hire purchase contract",
      "Rights of owner and hirer against third party",
      "Termination of hire purchase agreement",
      "Remedies for breach of hire purchase agreement",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 11,
    "title": "Insurance",
    "topics": [
      "Insurance distinguished from assurance",
      "Marine insurance",
      "Insurable interest",
      "Subrogation",
      "Indemnity",
      "Double insurance and contribution",
      "Assignment of insurance policy",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 12,
    "title": "Banking",
    "topics": [
      "Bank and the banker",
      "Banking business",
      "Bank customer",
      "Rights of a bank",
      "The Central Bank of Nigeria",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 13,
    "title": "Negotiable instruments",
    "topics": [
      "Types of negotiable instrument",
      "Endorsement of a bill",
      "Negotiation of a bill",
      "Capacity and liability of parties to a bill",
      "Signatures",
      "Holder of a bill of exchange",
      "Discharge of a bill",
      "Dishonour of a bill",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 14,
    "title": "Cheques",
    "topics": [
      "Parties to a cheque",
      "Differences between a cheque and other bills of exchange",
      "Types of cheque",
      "Types of crossing",
      "Material alteration",
      "Forged cheque",
      "Promissory note",
      "Holder",
      "Countermand of payment",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 15,
    "title": "Employment law",
    "topics": [
      "Meaning of employment",
      "Formation of contract of employment",
      "Forms of contract",
      "Duties of an employee",
      "Duties of employer",
      "Termination of employment contract",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 16,
    "title": "Administration of estates and trusts",
    "topics": [
      "Wills",
      "Trusts",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 17,
    "title": "Alternative Dispute Resolution (ADR)",
    "topics": [
      "Alternative Dispute Resolution (ADR)",
      "Arbitration",
      "Limitations to the adoption of ADR mechanisms",
      "Chapter review & worked examples"
    ]
  },
  {
    "no": 18,
    "title": "Application of information technology in business",
    "topics": [
      "Laws governing electronic transactions",
      "Laws protecting e-commerce activities in Nigeria",
      "Electronic contracts: click-wrap and shrink-wraps agreements",
      "Jurisdictional issues in electronic contracts",
      "The place of electronic evidence in the Nigeria Legal System",
      "Chapter review"
    ]
  }
];

const FINANCIAL_ACCOUNTING_CHAPTERS = [
  {
    "no": 1,
    "title": "An Introduction to Business and Accounting",
    "topics": [
      "Business",
      "Introduction to Financial Accounting by Business Entities",
      "Roles of accountants and those charged with governance",
      "Financial statements",
      "Regulation of financial reporting",
      "Bases of Accounting",
      "The Components of Financial statements",
      "Business Transactions",
      "Ethical Considerations for Preparers of Financial Statements",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 2,
    "title": "The IASB's Conceptual Framework for Financial Reporting",
    "topics": [
      "A Conceptual Framework for Financial Reporting",
      "The IASB Conceptual Framework",
      "Qualitative Characteristics Of Useful Financial Information",
      "Recognition in Financial Statements: IASB Conceptual Framework",
      "Other Accounting Concepts",
      "Fair presentation",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 3,
    "title": "Accounting equation and the double entry system",
    "topics": [
      "The Accounting equation",
      "Introduction to accounting systems",
      "Basic Rules Of Double Entry Bookkeeping",
      "Account balances and the trial balance",
      "The Journal And Transaction Recording",
      "The chart of accounts and the general ledger",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 4,
    "title": "Books of prime entry and banking procedures",
    "topics": [
      "The books of prime entry",
      "Accounting For Sales",
      "Accounting for Purchases",
      "Accounting For Cash",
      "Petty Cash",
      "Value Added Tax (VAT)",
      "Banking Procedures And Documentation",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 5,
    "title": "Non-current assets and depreciation",
    "topics": [
      "Non-Current Assets",
      "Depreciation and carrying amount",
      "Revaluation Of Property, Plant And Equipment",
      "De recognition of property, plant and equipment",
      "Disclosure requirements of IAS 16",
      "Intangible Assets",
      "Impairment of assets",
      "Assets Register",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 6,
    "title": "Bad and doubtful debt",
    "topics": [
      "Bad debts and doubtful debts",
      "Doubtful Debts",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 7,
    "title": "Accrual and prepayment",
    "topics": [
      "Accruals and prepayments introduced",
      "Accruals",
      "Prepayments",
      "Unearned and accrued income",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 8,
    "title": "Inventory",
    "topics": [
      "End-of-year adjustments for inventory",
      "Measurement of Inventory",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 9,
    "title": "Control Accounts and Control Account Reconciliation",
    "topics": [
      "Receivables Control Accounts And Receivables Control Account Reconciliations .. 293",
      "Payables Control Accounts And Payables Control Account Reconciliations",
      "Supplier Statements: Reconciliation With Ledger Account",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 10,
    "title": "Bank Reconciliations",
    "topics": [
      "Bank Reconciliations",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 11,
    "title": "Correction of Errors, Provisions, Contingent Liabilities and Contingent Assets",
    "topics": [
      "Trial Balance",
      "Correcting Errors",
      "Suspense Accounts",
      "Provisions, Contingent Liabilities, And Contingent Assets",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 12,
    "title": "Preparation of Financial Statements",
    "topics": [
      "Financial Statements",
      "Preparing Financial Statements",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 13,
    "title": "Preparation of Company Financial Statements",
    "topics": [
      "The Components Of Financial Statements",
      "Structure and Content of the Statement of Financial Position",
      "Structure And Content Of The Statement Of Profit Or Loss And Other Comprehensive Income",
      "Accounting For Taxation",
      "Accounting For Share Issue",
      "Financial Statement-Specimen Formats",
      "Ias: Accounting Policies, Changes In Accounting Estimates And Errors",
      "IFRS 18: Presentation and Disclosure in Financial Statements",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 14,
    "title": "Preparation of Partnership Accounts",
    "topics": [
      "Features Of Partnerships",
      "Sharing The Profits Between The Partners",
      "Changes in Partnerships",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 15,
    "title": "Preparation of Accounts from Incomplete Records",
    "topics": [
      "The Nature Of Incomplete Records",
      "Techniques For Incomplete Records",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 16,
    "title": "Preparation of Not-For-Profit Accounts",
    "topics": [
      "Not-For-Profit Organisations",
      "Receipt and Payment Accounts",
      "Income and Expenditure account",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 17,
    "title": "IAS7: Statement of Cash Flows and Introduction to Statement of Changes in Equity",
    "topics": [
      "Statement of Cash Flows: Introduction",
      "Statement of Cash Flows: Format",
      "Cash Flows From Operating Activities: The Indirect Method",
      "Indirect Method: Adjustments For Working Capital",
      "Cash Flows from Operating Activities: The Direct Method",
      "Cash Flows From Investing Activities",
      "Cash Flows from Financing Activities",
      "Statement Of Cash Flows - Specimen Formats",
      "Introduction To Statement Of Changes In Equity(SoCIE)",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 18,
    "title": "Interpretation to Financial Statements",
    "topics": [
      "Interpretation Of Financial Statements",
      "Profitability Ratios",
      "Efficiency Ratios",
      "Liquidity Or Short-Term Solvency Ratios",
      "Long-Term Stability Ratios",
      "Comparative Financial Statements Analysis",
      "Benefit and limitations of ratio analysis",
      "Chapter review & end-of-chapter questions"
    ]
  },
  {
    "no": 19,
    "title": "Computerised and Virtual Accounting System",
    "topics": [
      "Computerised Accounting Systems",
      "Digitisation in financial accounting",
      "Uses of data structure",
      "Blockchain technology",
      "The Use Of Artificial Intelligence (AI) In Financial Accounting",
      "Opportunities For Fraud From Working Remotely",
      "Virtual Accounting Principles And Practice",
      "Chapter review & end-of-chapter questions"
    ]
  }
];

const DEFAULT_PROGRAM_ID = 'icaz-ma';
const CORPORATE_LAW_PROGRAM_ID = 'icaz-cbl';
const FINANCIAL_ACCOUNTING_PROGRAM_ID = 'icaz-fin';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LIBRARY_FORMATS = [
  { id: 'document', label: 'Document', plural: 'Documents', icon: 'file-text', hint: 'PDFs, notes, study texts and past papers' },
  { id: 'video', label: 'Video', plural: 'Videos', icon: 'play', hint: 'YouTube, Vimeo or a direct video file' },
  { id: 'audio', label: 'Audio', plural: 'Audio', icon: 'headphones', hint: 'Recordings, MP3s or podcast episodes' },
  { id: 'image', label: 'Image', plural: 'Images', icon: 'image', hint: 'Diagrams, charts, photos or screenshots' },
  { id: 'link', label: 'Link', plural: 'Links', icon: 'link', hint: 'Any useful web page or reference' }
];
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const LEGACY_FORMAT_MAP = { video: 'video', notes: 'document', textbook: 'document', 'past-paper': 'document', formula: 'document', other: 'link' };
const LIBRARY_STATUSES = [
  { id: 'to-read', label: 'To read' },
  { id: 'reading', label: 'Reading' },
  { id: 'done', label: 'Finished' },
  { id: 'reference', label: 'Reference' }
];
function libraryStatus(id) {
  return LIBRARY_STATUSES.find(status => status.id === id) || LIBRARY_STATUSES[0];
}
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(raw)) return 'https://' + raw;
  return '';
}
function libraryFormat(id) {
  const key = String(id || '');
  const direct = LIBRARY_FORMATS.find(format => format.id === key);
  if (direct) return direct;
  const legacy = LEGACY_FORMAT_MAP[key];
  if (legacy) return LIBRARY_FORMATS.find(format => format.id === legacy);
  return LIBRARY_FORMATS[0];
}
function normalizeFormatId(value) {
  return libraryFormat(value).id;
}
function fileExtension(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}
function formatForFile(file) {
  const mime = String(file && file.type || '').toLowerCase();
  const ext = fileExtension(file && file.name);
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (mime === 'application/pdf' || ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'rtf', 'xls', 'xlsx', 'odt', 'ods'].includes(ext)) return 'document';
  return '';
}
function fileSizeLabel(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(size < 10 * 1024 ? 1 : 0) + ' KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
  return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}
function isDirectImage(url) {
  return /\.(png|jpe?g|gif|webp|svg|bmp)(?:[?#]|$)/i.test(String(url || ''));
}
function youtubeId(url) {
  const match = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  return match ? match[1] : '';
}
function vimeoId(url) {
  const match = String(url || '').match(/vimeo\.com\/(\d+)/i);
  return match ? match[1] : '';
}
function isDirectVideo(url) {
  return /\.(mp4|webm|ogv|ogg|mov)(?:[?#]|$)/i.test(String(url || ''));
}
function isDirectAudio(url) {
  return /\.(mp3|wav|m4a|aac|ogg|flac)(?:[?#]|$)/i.test(String(url || ''));
}
function isPdf(url) {
  return /\.pdf(?:[?#]|$)/i.test(String(url || ''));
}
function previewSource(resource) {
  const url = safeUrl(resource.url);
  if (!url) return { kind: 'none', src: '', external: '' };
  const format = normalizeFormatId(resource.format || resource.type);
  if (format === 'video') {
    const yt = youtubeId(url);
    if (yt) return { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + yt + '?rel=0', external: url };
    const vm = vimeoId(url);
    if (vm) return { kind: 'vimeo', src: 'https://player.vimeo.com/video/' + vm, external: url };
    if (isDirectVideo(url)) return { kind: 'video', src: url, external: url };
    return { kind: 'external', src: url, external: url };
  }
  if (format === 'audio') {
    if (isDirectAudio(url)) return { kind: 'audio', src: url, external: url };
    return { kind: 'external', src: url, external: url };
  }
  if (format === 'document') {
    if (isPdf(url)) return { kind: 'pdf', src: url, external: url };
    return { kind: 'external', src: url, external: url };
  }
  if (format === 'image') {
    if (isDirectImage(url)) return { kind: 'image', src: url, external: url };
    return { kind: 'external', src: url, external: url };
  }
  return { kind: 'external', src: url, external: url };
}
function resourceDomain(url) {
  try {
    const parsed = new URL(safeUrl(url));
    return parsed.hostname.replace(/^www\./, '');
  } catch (err) {
    return '';
  }
}
function seedResources(programId) {
  const at = days => new Date(Date.now() - days * 86400000).toISOString();
  return [
    {
      id: uid('res'), programId: programId,
      title: 'Study text — cost classification & behaviour',
      format: 'document', chapter: 5, status: 'reading',
      url: 'https://www.icaz.org.zw/',
      note: 'Read the chapter examples before attempting the high-low method. Highlight the classification table and the worked semi-variable examples.',
      createdAt: at(9), updatedAt: at(0.2)
    },
    {
      id: uid('res'), programId: programId,
      title: 'Formula sheet — variances & CVP',
      format: 'document', chapter: 15, status: 'done',
      url: '',
      note: 'One-page recall sheet: material price and usage, labour rate and efficiency, contribution per unit, break-even and margin of safety.',
      createdAt: at(12), updatedAt: at(2)
    },
    {
      id: uid('res'), programId: programId,
      title: 'Past paper — Section B, 2024',
      format: 'document', chapter: 0, status: 'to-read',
      url: 'https://www.icaz.org.zw/',
      note: 'Timed attempt under exam conditions. Mark against the suggested solution, then log weak topics in the syllabus map.',
      createdAt: at(4), updatedAt: at(4)
    },
    {
      id: uid('res'), programId: programId,
      title: 'Lecture notes — functional budgets',
      format: 'document', chapter: 13, status: 'reading',
      url: '',
      note: 'Principal budget factor, production budget, material purchases and the cash budget outline. Add the worked example from class.',
      createdAt: at(6), updatedAt: at(1)
    },
    {
      id: uid('res'), programId: programId,
      title: 'Video — high-low method walkthrough',
      format: 'video', chapter: 5, status: 'done',
      url: 'https://www.youtube.com/results?search_query=high-low+method+management+accounting',
      note: 'A short walkthrough of separating fixed and variable costs. Pause after each step and redo the calculation without notes.',
      createdAt: at(8), updatedAt: at(3)
    },
    {
      id: uid('res'), programId: programId,
      title: 'Audio — deep work soundtrack',
      format: 'audio', chapter: 0, status: 'reference',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      note: 'Instrumental loop for long problem sets. Keep the volume low and use it with the 50-minute focus sprint.',
      createdAt: at(5), updatedAt: at(1.5)
    },
    {
      id: uid('res'), programId: programId,
      title: 'ICAZ — official student resources',
      format: 'link', chapter: 0, status: 'reference',
      url: 'https://www.icaz.org.zw/',
      note: 'Past papers, syllabus updates and student notices from the institute. Check this page before every mock exam.',
      createdAt: at(15), updatedAt: at(9)
    },
    {
      id: uid('res'), programId: programId,
      title: 'IFRS Foundation — standards updates',
      format: 'link', chapter: 0, status: 'to-read',
      url: 'https://www.ifrs.org/',
      note: 'A reference point for financial reporting updates that affect management accounting examples.',
      createdAt: at(10), updatedAt: at(6)
    }
  ];
}
function activeResources() {
  const program = activeProgram();
  if (!program) return [];
  return state.resources.filter(resource => (resource.programId || DEFAULT_PROGRAM_ID) === program.id);
}
function libraryStats() {
  const list = activeResources();
  const byFormat = {};
  const byStatus = {};
  const chapters = new Set();
  list.forEach(resource => {
    const format = normalizeFormatId(resource.format);
    byFormat[format] = (byFormat[format] || 0) + 1;
    byStatus[resource.status] = (byStatus[resource.status] || 0) + 1;
    const chapterNo = Number(resource.chapter);
    if (chapterNo > 0 && chapterOf(chapterNo)) chapters.add(chapterNo);
  });
  return {
    total: list.length,
    finished: byStatus.done || 0,
    reading: byStatus.reading || 0,
    toRead: byStatus['to-read'] || 0,
    reference: byStatus.reference || 0,
    byFormat: byFormat,
    byStatus: byStatus,
    chaptersCovered: chapters.size,
    chapterTotal: activeChapters().length
  };
}
function resourceChapterLabel(resource) {
  const chapterNo = Number(resource.chapter);
  if (!chapterNo) return 'General · all chapters';
  const chapter = chapterOf(chapterNo);
  if (!chapter) return 'Chapter ' + chapterNo;
  const section = sectionOf(chapterNo);
  return 'Ch ' + pad2(chapter.no) + ' · ' + chapter.title + (section ? ' · ' + section.id : '');
}
function resourceMatches(resource, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const type = libraryFormat(resource.format);
  const status = libraryStatus(resource.status);
  const chapter = Number(resource.chapter) > 0 ? chapterOf(resource.chapter) : null;
  const section = chapter ? sectionOf(chapter.no) : null;
  const haystack = [
    resource.title, resource.note, type.label, status.label, resource.url, resource.fileName,
    chapter ? chapter.title : '', section ? section.name : ''
  ].join(' ').toLowerCase();
  return q.split(/\s+/).every(part => haystack.includes(part));
}

/* ---------- programs ---------- */
function makeProgram(options) {
  const opts = options || {};
  const sections = Array.isArray(opts.sections) && opts.sections.length
    ? opts.sections.map((section, index) => ({
        id: String(section.id || LETTERS[index] || 'S' + (index + 1)),
        name: String(section.name || 'Section ' + (index + 1)).slice(0, 60),
        short: String(section.short || section.name || 'Section ' + (index + 1)).slice(0, 40),
        weight: clamp(Number(section.weight) || 0, 0, 100)
      }))
    : [{ id: 'A', name: 'General', short: 'General', weight: 100 }];
  const chapterList = Array.isArray(opts.chapters) ? opts.chapters : [];
  const chapters = chapterList
    .filter(chapter => chapter && chapter.title)
    .map((chapter, index) => ({
      no: Number(chapter.no) || index + 1,
      section: sections.some(section => section.id === chapter.section) ? chapter.section : sections[0].id,
      title: String(chapter.title).slice(0, 120),
      topics: Array.isArray(chapter.topics) ? chapter.topics.map(topic => String(topic).slice(0, 120)).slice(0, 30) : []
    }));
  return {
    id: String(opts.id || uid('program')),
    name: String(opts.name || 'Untitled program').slice(0, 60),
    course: String(opts.course || 'Study program').slice(0, 60),
    examLabel: String(opts.examLabel || 'Exam').slice(0, 40),
    examDate: /^\d{4}-\d{2}-\d{2}$/.test(String(opts.examDate || '')) ? opts.examDate : dateKey(addDays(new Date(), 30)),
    targetHours: clamp(Number(opts.targetHours) || 3.5, 0.5, 12),
    createdAt: opts.createdAt || new Date().toISOString(),
    sections: sections,
    chapters: chapters
  };
}
function defaultProgram() {
  return makeProgram({
    id: DEFAULT_PROGRAM_ID,
    name: 'ICAZ 2026 · Foundation',
    course: 'Management Accounting',
    examLabel: 'ICAZ 2026 Core',
    examDate: dateKey(addDays(new Date(), 47)),
    targetHours: 3.5,
    sections: SECTIONS.map(section => ({ id: section.id, name: section.name, short: section.short, weight: section.weight })),
    chapters: CHAPTERS.map(chapter => ({ no: chapter.no, section: chapter.section, title: chapter.title, topics: chapter.topics.slice() }))
  });
}
function corporateLawProgram() {
  return makeProgram({
    id: CORPORATE_LAW_PROGRAM_ID,
    name: 'ICAZ 2026 · Foundation · Corporate & Business Law',
    course: 'Corporate and Business Law',
    examLabel: 'ICAZ Foundation',
    examDate: dateKey(addDays(new Date(), 47)),
    targetHours: 3.5,
    sections: [{ id: 'A', name: 'Corporate & business law', short: 'Corporate law', weight: 100 }],
    chapters: CORPORATE_LAW_CHAPTERS.map(chapter => ({
      no: chapter.no,
      section: 'A',
      title: chapter.title,
      topics: chapter.topics.slice()
    }))
  });
}
function financialAccountingProgram() {
  return makeProgram({
    id: FINANCIAL_ACCOUNTING_PROGRAM_ID,
    name: 'ICAZ 2026 · Foundation · Financial Accounting',
    course: 'Financial Accounting',
    examLabel: 'ICAZ Foundation',
    examDate: dateKey(addDays(new Date(), 47)),
    targetHours: 3.5,
    sections: [{ id: 'A', name: 'Financial accounting', short: 'Financial accounting', weight: 100 }],
    chapters: FINANCIAL_ACCOUNTING_CHAPTERS.map(chapter => ({
      no: chapter.no,
      section: 'A',
      title: chapter.title,
      topics: chapter.topics.slice()
    }))
  });
}
function activeProgram() {
  if (!state || !Array.isArray(state.programs) || !state.programs.length) return null;
  return state.programs.find(program => program.id === state.activeProgramId) || state.programs[0];
}
function activeChapters() {
  const program = activeProgram();
  return program ? program.chapters : [];
}
function activeSections() {
  const program = activeProgram();
  return program ? program.sections : [];
}

/* ---------- small utilities ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function uid(prefix) {
  return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
function icon(name, cls) {
  return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseKey(key) {
  const parts = String(key || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function todayKey() { return dateKey(new Date()); }
function mondayOf(d) { const day = (d.getDay() + 6) % 7; return addDays(startOfDay(d), -day); }
function fmtLong(d) { return DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function fmtMedium(d) { return DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; }
function fmtShort(d) { return DAY_SHORT[d.getDay()] + ' ' + d.getDate(); }
function fmtMonthRange(start, end) {
  if (start.getMonth() === end.getMonth()) return start.getDate() + ' – ' + end.getDate() + ' ' + MONTHS[start.getMonth()];
  return start.getDate() + ' ' + MONTHS_SHORT[start.getMonth()] + ' – ' + end.getDate() + ' ' + MONTHS_SHORT[end.getMonth()];
}
function repeatDates(startKey, mode) {
  const start = parseKey(startKey);
  if (mode === 'daily') {
    return Array.from({ length: 5 }, (_, i) => dateKey(addDays(start, i)));
  }
  if (mode === 'weekdays') {
    const out = [];
    let cursor = start;
    while (out.length < 10) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) out.push(dateKey(cursor));
      cursor = addDays(cursor, 1);
    }
    return out;
  }
  if (mode === 'weekly') {
    return Array.from({ length: 4 }, (_, i) => dateKey(addDays(start, i * 7)));
  }
  return [startKey];
}
function repeatDescription(startKey, mode) {
  const dates = repeatDates(startKey, mode);
  if (dates.length <= 1) return 'Creates 1 session on this day.';
  return 'Creates ' + dates.length + ' sessions · ' + fmtMonthRange(parseKey(dates[0]), parseKey(dates[dates.length - 1])) + '.';
}
function chunkTopics(topics, parts) {
  const list = Array.isArray(topics) ? topics.slice() : [];
  const n = clamp(Number(parts) || 1, 1, Math.max(1, list.length));
  const groups = [];
  let index = 0;
  for (let p = 0; p < n; p++) {
    const remaining = list.length - index;
    const take = Math.ceil(remaining / (n - p));
    groups.push(list.slice(index, index + take));
    index += take;
  }
  return groups.filter(group => group.length > 0);
}
function relativeDayLabel(key) {
  const diff = Math.round((parseKey(key) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return DAY_NAMES[parseKey(key).getDay()];
}
function timeToMin(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}
function minToTime(mins) { return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60); }
function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function fmtDuration(mins) {
  const m = Math.round(mins || 0);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return r + 'm';
  if (!r) return h + 'h';
  return h + 'h ' + r + 'm';
}
function timeRange(start, end) { return start + ' – ' + end; }
function priorityMeta(priority) {
  if (priority === 'practice') return { label: 'Practice', icon: 'edit' };
  if (priority === 'review') return { label: 'Review', icon: 'rotate' };
  return { label: 'Core study', icon: 'book' };
}
function sessionKind(start) {
  const m = timeToMin(start);
  if (isNaN(m)) return { label: 'Session', icon: 'sun' };
  if (m < 720) return { label: 'Morning', icon: 'sunrise' };
  if (m < 1020) return { label: 'Afternoon', icon: 'sun' };
  if (m < 1260) return { label: 'Evening', icon: 'sunset' };
  return { label: 'Night', icon: 'moon' };
}
function chapterOf(no) {
  const number = Number(no);
  return activeChapters().find(chapter => Number(chapter.no) === number) || null;
}
function sectionOf(no) {
  const chapter = chapterOf(no);
  if (!chapter) return null;
  return activeSections().find(section => section.id === chapter.section) || null;
}
function initials(name) {
  return String(name || 'StudyFlow').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function ringSVG(pct, cls) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(pct, 0, 1));
  return '<svg viewBox="0 0 44 44" aria-hidden="true">' +
    '<circle class="ring-track" cx="22" cy="22" r="' + r + '"></circle>' +
    '<circle class="ring-value" cx="22" cy="22" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>' +
    '</svg>' + (cls || '');
}
function statusOf(task) {
  const total = task.steps.length;
  const done = task.steps.filter(s => s.done).length;
  if (total > 0 && done === total) return 'done';
  const key = task.date;
  if (key < todayKey()) return 'overdue';
  if (key === todayKey()) {
    const now = nowMinutes();
    if (now >= timeToMin(task.start) && now < timeToMin(task.end)) return 'live';
    if (now >= timeToMin(task.end)) return 'overdue';
  }
  return 'upcoming';
}
function statusLabel(status, key) {
  if (status === 'done') return 'Completed';
  if (status === 'live') return 'In focus';
  if (status === 'overdue') return 'Unfinished';
  return 'Upcoming';
}
function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/* ---------- seed ---------- */
function makeSteps(texts, doneCount) {
  return texts.map((text, i) => ({ id: uid('step'), text: text, done: i < (doneCount || 0) }));
}
function makeTask(opts) {
  return {
    id: uid('task'),
    programId: opts.programId || DEFAULT_PROGRAM_ID,
    chapter: opts.chapter,
    title: opts.title,
    date: opts.date,
    start: opts.start,
    end: opts.end,
    priority: opts.priority || 'core',
    note: opts.note || '',
    steps: makeSteps(opts.steps || [], opts.done || 0),
    createdAt: new Date().toISOString()
  };
}
function buildSeed() {
  const now = new Date();
  const d = n => dateKey(addDays(now, n));
  const t = [];

  t.push(makeTask({
    chapter: 5, title: 'Cost classifications & behaviour', date: d(0), start: '08:30', end: '10:00', done: 2,
    note: 'Separate fixed, variable and semi-variable behaviour before attempting the high-low method.',
    steps: ['Fixed, variable & semi-variable cost behaviour', 'High-low method with worked examples', 'Practice questions 5.8 & 5.9']
  }));
  t.push(makeTask({
    chapter: 14, title: 'Standard costing — direct materials variances', date: d(0), start: '14:00', end: '15:30', done: 2,
    note: 'Draw the variance diagram from memory, then check it against the standard cost card.',
    steps: ['Material price & usage variance formulas', 'Mix & yield variance reconciliation', 'Two past-paper variance questions']
  }));
  t.push(makeTask({
    chapter: 15, title: 'Cost-volume-profit analysis', date: d(0), start: '17:00', end: '18:15', done: 1,
    priority: 'practice',
    note: 'Contribution per unit is the building block for every break-even calculation.',
    steps: ['Break-even point in units & revenue', 'Margin of safety & target profit', 'Sketch break-even and PV charts', 'Four end-of-chapter problems']
  }));
  t.push(makeTask({
    chapter: 1, title: 'Flashcard drill — data, information & quality', date: d(0), start: '20:30', end: '21:00', priority: 'review',
    note: 'Recall the ACCURATE qualities before checking your notes.',
    steps: ['ACCURATE qualities of good information', 'Planning, control & decision making', 'Roles of the management accountant']
  }));

  t.push(makeTask({
    chapter: 2, title: 'Information systems in organisations', date: d(-1), start: '09:00', end: '10:30', done: 3,
    steps: ['Role of information systems', 'Limitations of management information', 'Sources of internal & external data']
  }));
  t.push(makeTask({
    chapter: 6, title: 'Inventory valuation — FIFO & AVCO', date: d(-1), start: '16:00', end: '17:00', done: 2,
    priority: 'practice',
    steps: ['FIFO and AVCO ledger entries', 'EOQ with quantity discounts', 'Just-in-time benefits & risks']
  }));

  t.push(makeTask({
    chapter: 3, title: 'Spreadsheet models for cost analysis', date: d(-2), start: '10:00', end: '11:00', done: 2,
    steps: ['Spreadsheet features & uses', 'Build a simple cost model']
  }));
  t.push(makeTask({
    chapter: 12, title: 'Moving averages & seasonal variation', date: d(-2), start: '19:00', end: '20:30', done: 2,
    priority: 'practice',
    steps: ['Time series components', 'Centred moving averages', 'Seasonal index calculation']
  }));

  t.push(makeTask({
    chapter: 4, title: 'Big data & the analytics pyramid', date: d(-3), start: '09:30', end: '11:00', done: 3,
    steps: ['Big data characteristics', 'Data, information, knowledge, wisdom', 'Risks of data mining']
  }));
  t.push(makeTask({
    chapter: 7, title: 'Labour remuneration & turnover', date: d(-3), start: '15:00', end: '16:00', done: 1,
    steps: ['Time-based vs piecework systems', 'Labour turnover calculations']
  }));

  t.push(makeTask({
    chapter: 11, title: 'Cost control vs cost reduction', date: d(-4), start: '08:00', end: '09:00', done: 2,
    steps: ['Distinguish control and reduction', 'Value analysis & value engineering']
  }));

  t.push(makeTask({
    chapter: 13, title: 'Functional budgets & the principal budget factor', date: d(-6), start: '10:00', end: '12:00', done: 2,
    steps: ['Budgeting framework', 'Production & material budgets', 'Cash budget outline']
  }));
  t.push(makeTask({
    chapter: 8, title: 'Overhead apportionment & absorption', date: d(-7), start: '14:00', end: '15:30', done: 1,
    steps: ['Allocation vs apportionment', 'Reciprocal service department costs', 'Under & over absorption']
  }));

  return {
    version: 9,
    student: 'Tadiwa A.',
    activeProgramId: DEFAULT_PROGRAM_ID,
    programs: [defaultProgram(), corporateLawProgram(), financialAccountingProgram()],
    tasks: t,
    resources: seedResources(DEFAULT_PROGRAM_ID),
    focusSessions: [
      { id: uid('focus'), programId: DEFAULT_PROGRAM_ID, date: d(-1), minutes: 50, at: new Date().toISOString() },
      { id: uid('focus'), programId: DEFAULT_PROGRAM_ID, date: d(-2), minutes: 25, at: new Date().toISOString() },
      { id: uid('focus'), programId: DEFAULT_PROGRAM_ID, date: d(-3), minutes: 25, at: new Date().toISOString() }
    ]
  };
}

/* ---------- state ---------- */
let state = null;
const ui = {
  view: 'plan',
  date: todayKey(),
  weekStart: dateKey(mondayOf(new Date())),
  query: '',
  openChapters: new Set(),
  editingId: null,
  animate: true,
  lastChecked: null,
  carryDismissed: null,
  carryOpen: false,
  builderProgramId: null,
  libraryFormat: 'all',
  libraryStatus: 'all',
  librarySort: 'recent',
  editingResourceId: null,
  previewResourceId: null,
  previewObjectUrl: '',
  pendingFile: null,
  fileRemoved: false
};

function normalizeProgram(raw) {
  const program = makeProgram(raw || {});
  const usedSections = new Set();
  program.sections.forEach((section, index) => {
    let id = section.id || LETTERS[index] || 'S' + (index + 1);
    let suffix = 1;
    while (usedSections.has(id)) {
      id = (LETTERS[index] || 'S' + (index + 1)) + suffix;
      suffix++;
    }
    section.id = id;
    usedSections.add(id);
  });
  if (!program.sections.length) program.sections = [{ id: 'A', name: 'General', weight: 100 }];
  program.chapters.forEach(chapter => {
    if (!usedSections.has(chapter.section)) chapter.section = program.sections[0].id;
  });
  const usedNumbers = new Set();
  program.chapters.forEach(chapter => {
    let no = Number(chapter.no) || 1;
    while (usedNumbers.has(no)) no++;
    chapter.no = no;
    usedNumbers.add(no);
  });
  const totalWeight = program.sections.reduce((sum, section) => sum + section.weight, 0);
  if (totalWeight <= 0) {
    const even = Math.round(100 / program.sections.length);
    program.sections.forEach(section => { section.weight = even; });
  }
  return program;
}
function normalizeState(raw) {
  const fallback = buildSeed();
  if (!raw || typeof raw !== 'object') return fallback;

  let student = String(raw.student || (raw.profile && raw.profile.name) || 'Student').slice(0, 40);
  let programs = [];
  let activeId = raw.activeProgramId;

  if (Array.isArray(raw.programs) && raw.programs.length) {
    programs = raw.programs.map(normalizeProgram);
  } else if (raw.profile) {
    const legacy = raw.profile;
    const program = defaultProgram();
    program.name = String(legacy.program || program.name).slice(0, 60);
    program.course = String(legacy.course || program.course).slice(0, 60);
    program.examLabel = String(legacy.examLabel || program.examLabel).slice(0, 40);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(legacy.examDate || ''))) program.examDate = legacy.examDate;
    program.targetHours = clamp(Number(legacy.targetHours) || program.targetHours, 0.5, 12);
    programs = [program];
    activeId = program.id;
    student = String(legacy.name || student).slice(0, 40);
  } else {
    programs = [defaultProgram()];
  }

  const ids = new Set();
  programs.forEach(program => {
    let id = program.id;
    let suffix = 1;
    while (ids.has(id)) { id = program.id + '-' + suffix; suffix++; }
    program.id = id;
    ids.add(id);
  });
  if (Number(raw.version || 0) < 8 && !ids.has(CORPORATE_LAW_PROGRAM_ID)) {
    const bundled = corporateLawProgram();
    programs.push(bundled);
    ids.add(bundled.id);
  }
  if (Number(raw.version || 0) < 9 && !ids.has(FINANCIAL_ACCOUNTING_PROGRAM_ID)) {
    const bundled = financialAccountingProgram();
    programs.push(bundled);
    ids.add(bundled.id);
  }
  if (!activeId || !ids.has(activeId)) {
    activeId = (programs.find(program => program.id === DEFAULT_PROGRAM_ID) || programs[0]).id;
  }

  const tasks = Array.isArray(raw.tasks) ? raw.tasks
    .filter(task => task && task.date && task.start && task.end)
    .map(task => ({
      id: task.id || uid('task'),
      programId: ids.has(String(task.programId)) ? task.programId : activeId,
      chapter: Number(task.chapter) || 1,
      title: String(task.title || 'Study session').slice(0, 120),
      date: String(task.date),
      start: String(task.start),
      end: String(task.end),
      priority: ['core', 'practice', 'review'].includes(task.priority) ? task.priority : 'core',
      note: String(task.note || ''),
      steps: Array.isArray(task.steps) && task.steps.length
        ? task.steps.map(step => ({ id: step.id || uid('step'), text: String(step.text || ''), done: !!step.done }))
        : [{ id: uid('step'), text: 'Complete this session', done: false }],
      createdAt: task.createdAt || new Date().toISOString()
    })) : [];

  const focusSessions = Array.isArray(raw.focusSessions) ? raw.focusSessions
    .filter(session => session && session.date && session.minutes > 0)
    .map(session => ({
      id: session.id || uid('focus'),
      programId: ids.has(String(session.programId)) ? session.programId : activeId,
      date: String(session.date),
      minutes: clamp(Number(session.minutes) || 0, 1, 600),
      at: session.at || new Date().toISOString()
    })) : [];

  const hasResources = Array.isArray(raw.resources);
  const fallbackResourceProgram = ids.has(DEFAULT_PROGRAM_ID) ? DEFAULT_PROGRAM_ID : activeId;
  let resources = hasResources ? raw.resources
    .filter(resource => resource && resource.title)
    .map(resource => ({
      id: resource.id || uid('res'),
      programId: ids.has(String(resource.programId)) ? resource.programId : fallbackResourceProgram,
      title: String(resource.title || 'Untitled resource').slice(0, 120),
      format: normalizeFormatId(resource.format || resource.type),
      chapter: Number(resource.chapter) || 0,
      url: safeUrl(resource.url),
      fileId: resource.fileId ? String(resource.fileId) : '',
      fileName: resource.fileName ? String(resource.fileName).slice(0, 180) : '',
      fileType: resource.fileType ? String(resource.fileType) : '',
      fileSize: clamp(Number(resource.fileSize) || 0, 0, MAX_FILE_BYTES),
      note: String(resource.note || '').slice(0, 600),
      status: LIBRARY_STATUSES.some(status => status.id === resource.status) ? resource.status : 'to-read',
      favorite: !!resource.favorite,
      createdAt: resource.createdAt || new Date().toISOString(),
      updatedAt: resource.updatedAt || resource.createdAt || new Date().toISOString()
    })) : [];
  if (!hasResources && ids.has(DEFAULT_PROGRAM_ID)) resources = seedResources(DEFAULT_PROGRAM_ID);

  return { version: 9, student: student, activeProgramId: activeId, programs: programs, tasks: tasks, resources: resources, focusSessions: focusSessions };
}
function recoveryCopyKey() {
  return recoveryKey;
}
function emitSaveEvent(name, detail) {
  try {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || null }));
  } catch (err) { /* events are best effort */ }
}
function stashRecoveryCopy(raw) {
  try {
    const existing = Object.keys(localStorage)
      .filter(name => name.indexOf(RECOVERY_PREFIX) === 0)
      .sort();
    const duplicate = existing.find(name => localStorage.getItem(name) === raw);
    if (duplicate) return duplicate;
  } catch (err) { /* fall through and try to write */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
  const key = RECOVERY_PREFIX + stamp;
  try {
    localStorage.setItem(key, raw);
  } catch (err) {
    return '';
  }
  try {
    const keys = Object.keys(localStorage)
      .filter(name => name.indexOf(RECOVERY_PREFIX) === 0)
      .sort();
    while (keys.length > MAX_RECOVERY_COPIES) {
      localStorage.removeItem(keys.shift());
    }
  } catch (err) { /* pruning is best effort */ }
  return key;
}
function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (err) {
    saveFailureReason = 'unavailable';
    return null;
  }
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    recoveryKey = stashRecoveryCopy(raw);
    saveFailureReason = 'corrupt';
    return null;
  }
}
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    saveFailureReason = '';
    emitSaveEvent('studyflow:save-ok');
    return true;
  } catch (err) {
    saveFailureReason = err && err.name === 'QuotaExceededError' ? 'quota' : 'unavailable';
    emitSaveEvent('studyflow:save-failed', { reason: saveFailureReason });
    return false;
  }
}

/* ---------- calculations ---------- */
function activeTasks() {
  const program = activeProgram();
  if (!program) return [];
  return state.tasks.filter(task => (task.programId || DEFAULT_PROGRAM_ID) === program.id);
}
function tasksOn(key) {
  return activeTasks().filter(task => task.date === key)
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start) || a.title.localeCompare(b.title));
}
function taskMinutes(task) {
  const s = timeToMin(task.start);
  const e = timeToMin(task.end);
  return isNaN(s) || isNaN(e) ? 0 : Math.max(0, e - s);
}
function stepCounts(task) {
  const total = task.steps.length;
  const done = task.steps.filter(s => s.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}
function taskIsDone(task) {
  const c = stepCounts(task);
  return c.total > 0 && c.done === c.total;
}
function unfinishedTasks(days) {
  const today = todayKey();
  const start = dateKey(addDays(new Date(), -(Number(days) || 7)));
  return activeTasks()
    .filter(task => task.date < today && task.date >= start && !taskIsDone(task))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || timeToMin(a.start) - timeToMin(b.start));
}
function dayStats(key) {
  const tasks = tasksOn(key);
  let steps = 0, done = 0, planned = 0, logged = 0, complete = 0;
  tasks.forEach(task => {
    const c = stepCounts(task);
    steps += c.total;
    done += c.done;
    const mins = taskMinutes(task);
    planned += mins;
    logged += mins * c.ratio;
    if (c.total > 0 && c.done === c.total) complete++;
  });
  return { tasks, count: tasks.length, steps, done, planned, logged, complete, ratio: steps ? done / steps : 0 };
}
function statsForRange(startKey, endKey) {
  let days = 0, activeDays = 0, steps = 0, done = 0, logged = 0, planned = 0, tasks = 0, complete = 0;
  let cursor = parseKey(startKey);
  const end = parseKey(endKey);
  while (cursor <= end) {
    const s = dayStats(dateKey(cursor));
    days++;
    if (s.done > 0) activeDays++;
    steps += s.steps; done += s.done; logged += s.logged; planned += s.planned; tasks += s.count; complete += s.complete;
    cursor = addDays(cursor, 1);
  }
  return { days, activeDays, steps, done, logged, planned, tasks, complete, ratio: steps ? done / steps : 0 };
}
function overallStats() {
  let steps = 0, done = 0, planned = 0, logged = 0, complete = 0;
  const chaptersScheduled = new Set();
  const chaptersStarted = new Set();
  activeTasks().forEach(task => {
    const c = stepCounts(task);
    steps += c.total; done += c.done; complete += (c.total > 0 && c.done === c.total) ? 1 : 0;
    planned += taskMinutes(task); logged += taskMinutes(task) * c.ratio;
    if (c.total) chaptersScheduled.add(task.chapter);
    if (c.done > 0) chaptersStarted.add(task.chapter);
  });
  return {
    steps, done, planned, logged, complete,
    ratio: steps ? done / steps : 0,
    chaptersScheduled: chaptersScheduled.size,
    chaptersStarted: chaptersStarted.size,
    chaptersTotal: activeChapters().length
  };
}
function chapterStats(no) {
  const tasks = activeTasks().filter(t => Number(t.chapter) === Number(no));
  let steps = 0, done = 0, sessions = 0, complete = 0, minutes = 0, logged = 0;
  tasks.forEach(task => {
    const c = stepCounts(task);
    steps += c.total; done += c.done; sessions++;
    minutes += taskMinutes(task);
    logged += taskMinutes(task) * c.ratio;
    if (c.total > 0 && c.done === c.total) complete++;
  });
  return { tasks: sessions, steps, done, complete, minutes, logged, ratio: steps ? done / steps : 0, scheduled: sessions > 0 };
}
function sectionStats(id) {
  const sections = activeSections();
  const chapters = activeChapters().filter(c => c.section === id);
  let steps = 0, done = 0, sessions = 0, ratioSum = 0, started = 0;
  chapters.forEach(c => {
    const s = chapterStats(c.no);
    steps += s.steps;
    done += s.done;
    sessions += s.tasks;
    ratioSum += s.ratio;
    if (s.done > 0) started++;
  });
  return {
    chapters: chapters.length,
    steps: steps,
    done: done,
    sessions: sessions,
    started: started,
    ratio: steps ? done / steps : 0,
    mastery: chapters.length ? ratioSum / chapters.length : 0,
    brief: sections.find(section => section.id === id) || null
  };
}
function streakInfo() {
  const days = [];
  let startOffset = 0;
  if (dayStats(todayKey()).done === 0) startOffset = 1;
  for (let i = startOffset; i < 400; i++) {
    const key = dateKey(addDays(new Date(), -i));
    if (dayStats(key).done > 0) days.push(key);
    else break;
  }
  return { count: days.length, days };
}
function examDaysLeft() {
  const program = activeProgram();
  if (!program) return 0;
  const exam = parseKey(program.examDate);
  const diff = Math.ceil((startOfDay(exam) - startOfDay(new Date())) / 86400000);
  return diff;
}
function focusToday() {
  const key = todayKey();
  const program = activeProgram();
  if (!program) return { minutes: 0, count: 0 };
  let minutes = 0, count = 0;
  state.focusSessions.forEach(session => {
    if (session.date === key && session.programId === program.id) { minutes += session.minutes; count++; }
  });
  return { minutes, count };
}
function sessionsFor(key) {
  const program = activeProgram();
  if (!program) return [];
  return state.focusSessions
    .filter(session => session.date === key && session.programId === program.id)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateKey(addDays(new Date(), -i)));
  return out;
}
function searchTasks(tasks, query) {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(task => {
    const chapter = chapterOf(task.chapter);
    const haystack = [task.title, task.note, chapter ? chapter.title : '', ...task.steps.map(s => s.text)].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
function matchChapter(chapter, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (chapter.title + ' ' + chapter.topics.join(' ')).toLowerCase().includes(q);
}
