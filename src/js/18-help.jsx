
// ============================================================================
// HELP & GUIDE (in-app)
// ============================================================================
function HelpGuide({setPage}){
  const [section, setSection] = useState('setup_guide');

  const sections = [
    {id:'setup_guide', title:'Setup Guide (Start → Close FY)'},
    {id:'overview',  title:'Getting Started'},
    {id:'modules',   title:'Module Setup'},
    {id:'coa',       title:'Chart of Accounts'},
    {id:'parties',   title:'Customers & Vendors'},
    {id:'vouchers',  title:'Vouchers & Entries'},
    {id:'advanced',  title:'Advanced & New Features'},
    {id:'compliance',title:'Compliance & Tax Tools'},
    {id:'registers', title:'Registers'},
    {id:'inventory', title:'Inventory Module'},
    {id:'factory',   title:'Factory Module'},
    {id:'gstr1',     title:'GSTR-1'},
    {id:'gstr3b',    title:'GSTR-3B'},
    {id:'gstr2b',    title:'GSTR-2B Recon.'},
    {id:'tds',       title:'TDS Module'},
    {id:'hr',        title:'HR & Payroll'},
    {id:'reports',   title:'Reports & MIS'},
    {id:'forex',     title:'Forex'},
    {id:'data',      title:'Backup & Sync'},
    {id:'cost_dept', title:'Cost Centres & Depts'},
    {id:'user_config',title:'User Configuration'},
    {id:'shortcuts', title:'Quick Reference'},
  ];

  const content = {
    setup_guide: {
      title:'Setup Guide — Create Your Company → Close the Financial Year',
      body: [
        {type:'text', text:'This is the full lifecycle, in order: create the company, load opening balances, add your masters, run the year, then close it. If you\'re migrating from Tally, Zoho Books, QuickBooks, or a spreadsheet, jump straight to <b>"Migrating from Another System"</b> near the bottom  it lists exactly what data to have ready before you start.'},

        {type:'heading', text:'1. Create the Company'},
        {type:'steps', items:[
          'A brand-new login opens the <b>Setup Wizard</b> automatically. It has 4 steps: <b>Company</b> (name, GSTIN, PAN, state, email, phone, address  State and PAN auto-fill from a valid GSTIN), <b>Financial Year</b> (start/end dates  India defaults to 1 Apr–31 Mar), <b>Modules</b> (GST / TDS / Payroll / Trader / Factory / Service Sector  toggle only what this business needs), and <b>Get Paid</b> (your UPI ID, so invoices carry a scan-to-pay QR from day one).',
          'Skipped the wizard, or need to change something later? Everything it sets lives in <b>Company Settings</b>, including a <b>Launch Setup Wizard</b> button to re-run it.',
          'Upload a <b>company logo</b> and <b>bank details</b> here too  both print on GST invoices.',
        ]},

        {type:'heading', text:'2. Load Opening Balances'},
        {type:'text', text:'Every account in <b>Chart of Accounts</b> has an <code>opening</code> value. For a brand-new company with no prior books, leave these at zero and skip to Add Your Masters  there\'s nothing to carry forward.'},
        {type:'steps', items:[
          'For a business that already has books elsewhere (see the migration section below for the full data checklist), set each account\'s opening balance either by editing accounts one at a time, or in bulk via <b>Chart of Accounts → Import CSV</b>  the template\'s <code>opening</code> column is exactly this.',
          'Open <b>Trial Balance</b> as soon as opening balances are in and confirm it shows <b>zero difference</b> (Dr = Cr) before you post a single real voucher. An out-of-balance opening position only gets harder to trace the more transactions pile on top of it.',
        ]},
        {type:'tip', text:'Opening balances are entered once, right after company creation, before day-to-day vouchers begin. Fix any Trial Balance mismatch here  it is the cheapest point in the whole lifecycle to catch it.'},

        {type:'heading', text:'3. Add Your Masters'},
        {type:'steps', items:[
          '<b>Customers & Vendors</b>  add each party with GSTIN, state, and currency (needed for correct IGST vs CGST/SGST and for foreign-currency invoices).',
          '<b>Stock Items</b> (Trader/Factory only)  add each item with its opening quantity and opening value if you\'re carrying forward existing stock.',
          '<b>Employees</b> (Payroll only)  add via <b>HR & Payroll → Import CSV</b> for a bulk load, or one at a time.',
          '<b>Cost Centres & Departments</b>, if you track spend by project or team.',
        ]},

        {type:'heading', text:'4. Run the Year'},
        {type:'steps', items:[
          'Post day-to-day <b>Vouchers</b>  Sales, Purchase, Payment, Receipt, Journal, Credit/Debit Notes.',
          'File <b>GSTR-1</b> and <b>GSTR-3B</b> each period (if GST module is on); reconcile <b>GSTR-2B</b> against your purchase register.',
          'Run <b>Period Close</b> (Compliance) at each month/quarter end  it is a checklist: depreciation posted, prepaid/accrual amortisation run, bank reconciled, GST set off and filed, TDS deposited, statutory dues paid, closing provisions passed.',
        ]},

        {type:'heading', text:'5. Close the Financial Year'},
        {type:'steps', items:[
          'Open <b>Year-End Close</b> (Reports). It runs pre-close validation before letting you proceed: <b>hard checks</b> that block the close outright  Trial Balance tallies, every voucher is balanced, no voucher references a deleted account  and <b>soft checks</b> that warn but don\'t block, like entries dated after year-end or recurring templates not yet posted for the year.',
          'Fix every hard check first  the Close button stays disabled until they\'re clear.',
          'Closing the year <b>automatically downloads a full backup</b>, then locks books up to the FY-end date (no entry before that date can be added, edited, or cancelled afterwards), rolls the company\'s financial year forward, carries closing balances into the new year as continuous opening balances, and snapshots this year\'s P&L for use as a prior-year comparative.',
        ]},
        {type:'tip', text:'Books lock permanently up to the closed FY-end date once you confirm  there is no in-app "reopen" action. Run through the hard/soft checklist carefully and keep the auto-downloaded backup before confirming.'},

        {type:'heading', text:'Migrating from Another System (Tally, Zoho Books, QuickBooks, Excel)'},
        {type:'text', text:'Gather this <b>before</b> you start entering anything in MiyeeBooks. Pick a go-live date (typically the first day of a month or the FY), and pull every figure below <b>as of the day before</b> that date  those are your opening balances.'},
        {type:'steps', items:[
          '<b>Closing Trial Balance</b> from the old system, account by account  this is the single most important export. It becomes the <code>opening</code> column on your Chart of Accounts import.',
          '<b>Customer & Vendor list</b> with GSTIN, state, and currency, plus their outstanding balances  either one total per party (Debtors/Creditors), or invoice-wise if you want ageing to carry over exactly.',
          '<b>Stock-in-hand</b>: item, quantity, and value as of go-live (Trader/Factory businesses only).',
          '<b>Fixed asset register</b>: cost, accumulated depreciation, and written-down value per asset, if you\'ll use the Fixed Asset Register here.',
          '<b>Bank balances</b> matching your last reconciled statement, not just the passbook figure.',
          '<b>Outstanding statutory balances</b>: GST ITC carried forward, TDS deducted but not yet deposited, any PF/ESIC/PT dues pending.',
          '<b>Employee YTD payroll figures</b> if you\'re migrating mid-financial-year  needed to keep PF/ESIC/PT and Form 16 correct for the full year, not just the months since go-live.',
        ]},
        {type:'heading', text:'Loading Migration Data Into MiyeeBooks'},
        {type:'steps', items:[
          '<b>Chart of Accounts</b>: <b>Import CSV</b> with columns <code>code, name, type, group, schedule, opening, hsn, gstRate</code>. The <code>opening</code> column IS your opening trial balance  once every account is loaded with the correct signed balance, Dr equals Cr with no extra adjustment entry needed.',
          '<b>Customers & Vendors</b>: added one at a time  bulk CSV import isn\'t available for parties yet. If invoice-wise ageing doesn\'t matter to you, fold the total into the Debtors/Creditors account\'s opening balance above. If it does, raise a historical Sales or Purchase voucher dated at go-live for each open invoice instead  more setup work, but ageing stays accurate from day one.',
          'Anything else that isn\'t a simple account balance  historical adjustments, a multi-line opening journal, whatever your old system can export as a transaction list  goes through <b>Vouchers → Bulk Import Vouchers (CSV)</b>. Rows sharing the same date, type and reference group into one multi-line voucher, so an opening journal with 30 ledger lines is one CSV of 30 rows, all reference <code>OPEN-2025</code>, all type <code>JV</code>.',
          '<b>Stock Items</b>: added one at a time with opening quantity and opening value  no bulk CSV import yet for this master.',
          '<b>Employees</b>: <b>HR & Payroll → Import CSV</b> for a bulk load.',
        ]},
        {type:'tip', text:'Do the entire opening-balance load in one sitting, before posting a single real voucher for the new period, then check Trial Balance immediately. It must read zero difference before the year begins  that\'s the checkpoint that confirms the migration data went in correctly.'},
      ]
    },
    overview: {
      title:'Getting Started with MiyeeBooks',
      body: [
        {type:'text', text:'MiyeeBooks is a complete MSME accounting suite that runs entirely in your browser. No server, no installation  your data lives in your browser\'s localStorage and can be backed up to JSON or Google Drive.'},
        {type:'heading', text:'First-Time Setup (5 minutes)'},
        {type:'steps', items:[
          'Go to <b>Company Settings</b> → Enter your company name, GSTIN, PAN, address, FY dates.',
          '<b>Configure Modules</b> in the Module Configuration card  enable GST, TDS, Payroll, Trader, Factory, or Service Sector based on your business type. Click <b>Save Settings</b> and the sidebar adapts.',
          'Upload your <b>company logo</b> (PNG/JPG, max 500KB)  it appears on invoices and reports.',
          'Add <b>bank details</b> (A/c No, Bank, IFSC)  printed on GST invoices.',
          'Review the <b>Chart of Accounts</b>  40+ accounts are pre-loaded (Schedule III aligned). Add/edit as needed.',
          'Add your <b>Customers & Vendors</b> with GSTIN, state code, and currency.',
          'Start posting <b>Vouchers</b>  Sales, Purchase, Payment, Receipt, Journal.',
        ]},
        {type:'heading', text:'Navigation'},
        {type:'text', text:'The left sidebar organizes all modules. Click any item to open it. The top bar shows your company name, GSTIN, and financial year at all times.'},
      ]
    },
    modules: {
      title:'Module Setup  Activate Your Business Modules',
      body: [
        {type:'text', text:'MiyeeBooks is designed for every type of MSME  manufacturers, traders, service providers, and mixed businesses. You only see the features your business needs. Everything else stays hidden to keep the interface clean.'},
        {type:'heading', text:'How to Configure Modules'},
        {type:'steps', items:[
          'Go to <b>Company Settings</b> from the sidebar (Masters section).',
          'Scroll to the <b>Module Configuration</b> card (below Company Logo).',
          'Click any module card to <b>toggle it on or off</b>  the card lights up in colour when active.',
          'Click <b>Save Settings</b>  the sidebar updates to show/hide relevant sections.',
        ]},
        {type:'heading', text:'Available Modules'},
        {type:'steps', items:[
          '<b>GST Module ◑</b>  Unlocks: GSTR-1 (outward supplies return), GSTR-3B (summary return with ITC), GSTR-2B Reconciliation. Mandatory if your business is GST registered.',
          '<b>TDS Module §</b>  Unlocks: TDS Sections master (rates, thresholds, linked ledgers), Apply TDS on vouchers, TDS Deducted Report (Form 26Q / 24Q data). For businesses that deduct TDS on payments.',
          '<b>Payroll Module ☺</b>  Unlocks: Employee Master (with salary structure, PF/ESIC/PT setup), Run Payroll (monthly payroll with JV posting), Payslips (printable A4 payslip). For businesses with salaried employees.',
          '<b>Trader Module ▣</b>  Unlocks: Stock Items master, Stock Ledger (item-wise movement report), Inventory Movements log. Automatically tracks stock-in on Purchase vouchers and stock-out on Sales vouchers. For retail / wholesale businesses.',
          '<b>Factory Module ⚙</b>  Unlocks everything in Trader Module PLUS: Bill of Materials (BOM), Production Orders (RM consumption → FG production). For manufacturing businesses. Can be used together with Trader Module.',
          '<b>Service Sector ◎</b>  Marks your business as a service provider. SAC code defaults are prioritised, RCM tracking is highlighted, and service-specific COA groups are recommended. For IT, consulting, agencies.',
        ]},
        {type:'heading', text:'Which Modules Should I Enable?'},
        {type:'steps', items:[
          '<b>Pure Service Business (IT/Consulting/Agency):</b> GST + TDS + Payroll + Service Sector.',
          '<b>Retail / Wholesale Trader:</b> GST + TDS + Payroll + Trader Module.',
          '<b>Manufacturer:</b> GST + TDS + Payroll + Factory Module (includes Trader capabilities).',
          '<b>Manufacturer + Retail:</b> GST + TDS + Payroll + Factory + Trader  both inventory tracks run in parallel.',
          '<b>Sole Proprietor / Freelancer:</b> GST + TDS only. Keep Payroll off unless you have employees.',
        ]},
        {type:'tip', text:'Core accounting  Vouchers, Day Book, Trial Balance, P&L, Balance Sheet, Cash Flow, Ledger Statement, Debtors/Vendor Statements, Forex, MIS  are ALWAYS available regardless of modules. Modules only control the specialised sections.'},
      ]
    },
    coa: {
      title:'Chart of Accounts',
      body: [
        {type:'text', text:'The Chart of Accounts (COA) is your ledger master  every financial transaction hits one or more accounts here.'},
        {type:'heading', text:'How to Use'},
        {type:'steps', items:[
          'Go to <b>Chart of Accounts</b> from the sidebar.',
          'Use the <b>Search</b> box or <b>Type filter</b> (Asset / Liability / Equity / Income / Expense) to find accounts.',
          'Click <b>+ New Account</b> to add a custom account. Enter code (unique number), name, type, group, and opening balance.',
          'Each account is tagged with a <b>Schedule III head</b> (PPE, Trade Payables, Revenue, etc.) for automatic financial statement mapping.',
          'Accounts with GST rates (e.g., Sales 18%) auto-calculate tax in invoices.',
        ]},
        {type:'heading', text:'Pre-loaded Account Groups'},
        {type:'text', text:'Assets: Fixed Assets, Investments, Inventories, Trade Receivables, Cash & Bank, GST ITC. Liabilities: Borrowings, Trade Payables, GST/TDS/PF/ESIC Payable. Income: Revenue from Operations, Other Income. Expenses: Materials, Employee Benefits, Finance Costs, Depreciation, Other Expenses.'},
        {type:'tip', text:'Do NOT delete accounts that have voucher entries posted against them  the system will block you.'},
      ]
    },
    parties: {
      title:'Customers & Vendors',
      body: [
        {type:'text', text:'The Party Master holds all your customers and vendors with GSTIN, state, and currency information  essential for GST compliance.'},
        {type:'steps', items:[
          'Click <b>+ New Party</b> → Fill name, type (Customer/Vendor), GSTIN (15 chars), state, state code.',
          'For <b>foreign parties</b>, set currency to USD/EUR/GBP etc. and state to "Outside India".',
          'For <b>unregistered dealers</b>, leave GSTIN blank  they\'ll be tagged as URD automatically.',
          'The state code determines <b>inter-state vs intra-state</b> supply  IGST vs CGST/SGST split.',
        ]},
        {type:'tip', text:'State code "24" = Gujarat. If your company is 24 and customer is 27 (Maharashtra), the invoice will auto-apply IGST instead of CGST+SGST.'},
      ]
    },
    vouchers: {
      title:'Vouchers & Entries',
      body: [
        {type:'text', text:'Vouchers are the heart of the system. Every financial transaction is a voucher with double-entry lines (Debit = Credit).'},
        {type:'heading', text:'Voucher Types'},
        {type:'steps', items:[
          '<b>Sales (SAL)</b>  Create a GST tax invoice. Add line items with HSN, qty, rate, GST%. System auto-generates Dr Debtor / Cr Sales + GST Output lines.',
          '<b>Purchase (PUR)</b>  Record purchase invoice. Add items similarly. Dr Purchase + GST ITC / Cr Creditor. You can <b>apply TDS</b> on purchases.',
          '<b>Payment (PAY)</b>  Record payment to vendor/expense. Pick bank account and contra account.',
          '<b>Receipt (REC)</b>  Record receipt from customer. Pick bank and income/debtor account.',
          '<b>Journal (JV)</b>  General journal entry with manual Dr/Cr lines. Used for adjustments, provisions, depreciation, payroll.',
          '<b>Contra (CON)</b>  Cash-to-bank or bank-to-bank transfer.',
          '<b>Credit Note (CRN)</b>  Sales return or discount. Works like reverse Sales. Pick <b>Against Sales Invoice</b> to link it to the original bill (its outstanding reduces automatically everywhere), or leave it on <b>Self</b> for a general adjustment.',
          '<b>Debit Note (DBN)</b>  Purchase return. Works like reverse Purchase. Same <b>Against Purchase Invoice / Self</b> choice  linking it helps purchase-side reconciliation and keeps Bill-wise Ageing accurate.',
        ]},
        {type:'heading', text:'TDS in Vouchers'},
        {type:'text', text:'When posting Purchase, JV, or Payment vouchers, check "<b>Apply TDS</b>" at the bottom. Select the TDS section  rate and amount auto-calculate. The TDS amount credits the linked TDS Payable ledger. Net payable = Invoice amount − TDS.'},
        {type:'heading', text:'Printing & Sharing Invoices'},
        {type:'text', text:'Click <b>⎙ PDF</b> on any Sales/Purchase/CN/DN row. The invoice opens in a new window with <b>💬 WhatsApp</b> and <b>📧 Email</b> buttons (pre-filled message  attach the saved PDF) plus Print/Save-as-PDF. Use <b>⊕ e-Inv</b> to download the IRP e-invoice JSON.'},
        {type:'heading', text:'UPI Pay-Now QR on Invoices'},
        {type:'text', text:'Set your <b>UPI ID</b> in Company Settings (next to Bank Details). Every sales invoice then prints a <b>📱 Scan &amp; Pay QR</b> with the exact invoice amount and number pre-filled - customers scan with GPay/PhonePe/Paytm/BHIM and pay instantly. <b>Important:</b> it must be your <b>real, active</b> UPI ID - UPI apps verify the payee, so a made-up/demo ID shows "payee not registered". After saving, print one invoice and test-pay yourself ₹1. (QR renders when online; the UPI ID always prints as text.)'},
        {type:'heading', text:'Works on Mobile'},
        {type:'text', text:'On phones and small screens the sidebar becomes a <b>☰ menu</b>, dashboards stack into two columns, and tables scroll sideways - check cash, chase payments or raise an invoice from anywhere.'},
        {type:'heading', text:'Invoice Templates (10 designs)'},
        {type:'text', text:'Company Settings → <b>GST Invoice Template</b> now offers <b>10 templates across 5 layouts</b>: <b>Classic</b> (dark header band  5 colourways), <b>Modern</b> (full-colour header, soft cards  Blue/Teal), <b>Minimal Mono</b> (letterhead-style thin rules), <b>Elegant Gold</b> (centered serif with double rules) and <b>Boxed Navy</b> (framed page with accent side-band). Every invoice also prints the <b>Due Date</b> (invoice date + the customer\'s credit days), the <b>e-Invoice IRN/Ack strip</b> when the voucher carries an IRN, amount in words, HSN summary, bank details, a declaration and E.&amp;O.E.'},
        {type:'heading', text:'Time-savers'},
        {type:'steps', items:[
          '<b>⧉ Copy</b>  duplicate any voucher into a new one, pre-filled, so you only change what differs. Great for repeat invoices/payments.',
          '<b>🔁 Recurring monthly</b>  tick this on a voucher (rent, salary, AMC, subscription invoices). The Dashboard then reminds you each month and re-posts it with one click.',
          '<b>Search & filter</b>  the Vouchers list has a search box (number, party, narration, reference) and pages 50 at a time.',
          '<b>Configurable numbering</b>  set a custom prefix / FY / digit format per voucher type in Company Settings → Voucher Numbering Series.',
        ]},
        {type:'tip', text:'The system checks Dr = Cr before posting. If your entry is unbalanced, fix it before posting. Closed/locked periods (Year-End) block back-dated entries.'},
      ]
    },
    advanced: {
      title:'Advanced & New Features',
      body: [
        {type:'text', text:'Beyond core accounting, MiyeeBooks includes analysis and automation tools to save time and add insight.'},
        {type:'heading', text:'Valuation / Financial Model'},
        {type:'steps', items:[
          '<b>Overview</b>  historical &amp; run-rate revenue/EBITDA (pulled from closed-year snapshots + your current run-rate), historical CAGR, and a <b>football-field chart</b> blending DCF and comparable-multiple ranges into one view.',
          '<b>DCF Model</b>  a 5-year free-cash-flow-to-firm projection with editable growth, margin, tax, D&amp;A, CapEx and working-capital assumptions; choose <b>Gordon Growth</b> or an <b>exit-multiple</b> terminal value; a sensitivity table shows how the discount rate swings the answer.',
          '<b>Comparables</b>  apply EV/Revenue and EV/EBITDA multiple ranges (from recent deals or listed peers) to your trailing financials for an implied valuation range.',
          '<b>Funding Round</b>  standard priced-round math (pre/post-money, dilution %, price/share, new shares) plus the <b>VC Method</b> (exit value ÷ target multiple) as an early-stage sanity check.',
          'This is a founder\'s working model, not a substitute for a Registered Valuer\'s report - Companies Act, FEMA and Income-tax filings need one.',
        ]},
        {type:'heading', text:'CFO Dashboard & MIS'},
        {type:'steps', items:[
          '<b>13-Week Cash Forecast</b>  weekly cash projection: receivables collect on due date (invoice + credit days), payables go out likewise, plus recurring entries, average payroll and the next GST/TDS dues. Highlights the lowest-cash week and warns of a projected gap  the classic CFO survival tool.',
          '<b>Cash Runway & Burn</b>  the CFO Dashboard now shows your average monthly burn, months of runway at the current burn rate, average monthly revenue and cash on hand  the metrics investors and founders watch first.',
          '<b>DSO vs DPO trend</b>  a month-by-month chart of collection days (DSO) vs payment days (DPO) with the net cash gap, so you can see your working-capital cycle improving or slipping.',
          '<b>MIS Pack (Excel)</b>  one click exports a multi-sheet workbook (KPIs, monthly trend, top parties, expense breakdown) ready for a board or investor update.',
          '<b>PDF Bundle</b>  one click opens a print-ready bundle (cover, financial summary, Profit &amp; Loss, Balance Sheet, cash position)  save as a single PDF for your board pack or bank.',
          '<b>Group Consolidation</b> (holding + subsidiaries)  your <b>first company is the Holding</b>; when adding more companies just pick <b>“Subsidiary of …”</b> - the group links automatically. The Consolidation page shows a combined CFO dashboard plus <b>full consolidated Trial Balance, P&amp;L and Balance Sheet</b> - account-by-account with a column per entity, an Eliminations column and the consolidated figure. Needs cloud sign-in.',
          '<b>Intercompany eliminations</b>  add the other group company as a party <b>with its GSTIN</b> in each entity\'s books; the Eliminations tab then auto-matches intercompany sales↔purchases and receivables↔payables, eliminates the <b>matched</b> amount (mismatches are flagged, never silently removed) and the toggle applies it across all consolidated statements. Unrealised stock profit / minority interest still need manual JVs (AS-21).',
          '<b>Smart entry suggestion</b>  pick a party on a new voucher and a 💡 chip offers the last similar entry - one click copies the items, accounts, narration and TDS setup with today\'s date and a fresh number.',
        ]},
        {type:'heading', text:'Fund Flow & Duplicate Guards'},
        {type:'steps', items:[
          '<b>Fund Flow Statement</b>  the sources-and-applications view banks/CAs ask for: funds from operations (profit + depreciation), capital raised, loans, fixed-asset purchases/sales, reconciled to the change in working capital (with an opening-vs-closing WC schedule).',
          '<b>Duplicate guards</b>  the party form flags a GSTIN already used by another party; a Payment/Receipt warns if a near-identical one (same party + amount, within 4 days) already exists - catching double payments.',
          '<b>Recurring catch-up</b>  if a recurring entry was missed for several months, the Dashboard shows "N months due" and posts one for every missed month in a click.',
        ]},
        {type:'heading', text:'Analysis Reports (Account Manager)'},
        {type:'steps', items:[
          '<b>Budget vs Actual</b>  set an annual budget per P&L account; the report pro-rates it to the period and shows favourable/adverse variance. Click Save Budgets to keep them.',
          '<b>Profitability Analysis</b>  revenue and gross margin by Item, Customer, or HSN. COGS is estimated from your average purchase rate per HSN/item.',
          '<b>P&L Monthly Trend</b> & <b>Compare PY</b>  see month-by-month P&L and prior-year comparison.',
        ]},
        {type:'heading', text:'Sales Pipeline & Collections'},
        {type:'steps', items:[
          '<b>Quotations & Challans</b> (Accountant menu)  create a Quotation or Proforma Invoice, print/WhatsApp it, track its status (Draft → Sent → Accepted), then click <b>→ Invoice</b> to convert it into a posted GST sales invoice in one click - no re-typing. Delivery Challans cover goods sent without an invoice (job work / approval).',
          '<b>Collections / Reminders</b>  lists every invoice past the customer\'s credit period with one-click <b>💬 WhatsApp</b> / <b>📧 Email</b> payment reminders. The tone escalates automatically: gentle (≤15 days) → firm (≤45) → final notice (cites MSMED-Act interest).',
          '<b>Credit control</b>  when you raise a sales invoice, a banner warns if the customer would exceed their credit limit or already has overdue bills.',
          '<b>🚚 e-Way</b>  on sales rows over ₹50,000, downloads the NIC e-Way Bill bulk-upload JSON (you\'ll be prompted for vehicle no. / distance - leave blank to fill on the portal).',
        ]},
        {type:'heading', text:'Stock Valuation & Alerts'},
        {type:'steps', items:[
          '<b>Stock Valuation</b> (Cost Accountant → inventory)  weighted-average cost per item; production orders absorb the consumed material value into finished goods. Shows computed vs book value and posts the <b>closing-stock JV</b> (Dr/Cr Inventory ↔ Changes in Inventories) in one click so the P&L reflects true COGS.',
          '<b>Low-stock alert</b>  the Dashboard flags items at or below their reorder level.',
        ]},
        {type:'heading', text:'Faster, Safer Data Entry'},
        {type:'steps', items:[
          '<b>Duplicate-number warning</b>  the voucher screen flags in red if another live voucher of the same type already uses the number you typed, so you catch double entries before posting.',
          '<b>GSTIN checksum validation</b>  when you type a 15-char GSTIN on a party or in Company Settings, MiyeeBooks verifies the official check digit and shows ✓ Valid / ✗ Invalid checksum instantly. The Data Health Check also batch-validates every stored GSTIN.',
          '<b>Auto-Balance</b>  on manual (JV/Payment) entries, one click sets the balancing figure (net of TDS).',
          '<b>Bulk CSV import</b> & <b>Duplicate voucher</b>  import many vouchers from a template, or copy any existing voucher as a starting point.',
          '<b>Function keys (Tally-style)</b>  F4 Contra · F5 Payment · F6 Receipt · F7 Journal · F8 Sales · F9 Purchase open a new voucher of that type from anywhere; Esc closes the voucher window.',
          '<b>📎 Attachments</b>  attach up to 3 bill/receipt images or PDFs (400 KB each) to any voucher; a paperclip shows on the voucher list and files open in a new tab.',
          '<b>🌙 Dark mode</b>  toggle from the top bar; remembered per browser.',
        ]},
        {type:'heading', text:'Fixed Assets & Period-End (Cost Accountant)'},
        {type:'steps', items:[
          '<b>Fixed Asset Register</b>  record assets and compute depreciation under both Companies Act (WDV/SLM, day-prorated) and Income-Tax (block WDV, 180-day half rule). One click posts the depreciation JV.',
          '<b>Prepaid Amortization</b>  spread a prepaid expense (insurance/AMC/rent) over N months; "Post N due" auto-posts each month\'s Dr-expense / Cr-prepaid JV.',
        ]},
        {type:'heading', text:'Local Storage Upgraded (IndexedDB)'},
        {type:'text', text:'Local-mode data now lives in <b>IndexedDB</b> (hundreds of MB) instead of localStorage (~5 MB cap) - years of vouchers and attachments fit safely. Your existing data <b>migrates automatically</b> the first time you open the app after this upgrade; nothing to do. If the browser blocks IndexedDB (some private modes), the app quietly falls back to localStorage. Cloud sync is unchanged.'},
        {type:'heading', text:'Data Health & Closing (Auditor)'},
        {type:'steps', items:[
          '<b>Data Health Check</b>  live checks: Trial Balance tallies, no unbalanced/orphan/empty vouchers, no duplicate numbers, GST posted to GST ledgers, negative cash, data size. Run it before filing or year-end.',
          '<b>Audit Trail</b>  every create/edit/cancel/import logged with user & timestamp.',
          '<b>Year-End Closing</b>  locks the FY, carries balances forward, downloads a backup.',
        ]},
        {type:'tip', text:'Reports always tally: Trial Balance, Balance Sheet and Cash Flow derive totals from account TYPES (not fixed codes), so they stay correct even if you restructure your chart of accounts.'},
      ]
    },
    compliance: {
      title:'Compliance & Tax Tools',
      body: [
        {type:'heading', text:'Compliance Calendar'},
        {type:'text', text:'Shows your <b>upcoming and recent filing/payment deadlines</b> (next 90 / last 45 days)  GSTR-1, GSTR-3B + GST payment, TDS challan, PF/ESIC ECR, Professional Tax, TDS returns, advance tax, GSTR-9. Each row carries <b>that period\'s liability</b> (not a cumulative figure) with days-to-due colour coding and an Open shortcut. The Dashboard also surfaces the nearest dues.'},
        {type:'heading', text:'Period Close'},
        {type:'text', text:'Month/quarter-end helper: computes the <b>GST ITC set-off</b> head-wise (CGST/SGST/IGST) and posts the set-off JV with one click, plus a close checklist that jumps you to depreciation, amortization, bank reco, GSTR-3B, TDS and statutory dues.'},
        {type:'heading', text:'Advance Tax Estimator'},
        {type:'steps', items:[
          '<b>How the income is derived:</b> YTD Income − Expenses from your books (Apr → today) = profit for the months elapsed, then <b>annualised</b> (× 12 ÷ months) to project the full year. You can switch to "Use YTD only" or "Enter manually".',
          '<b>Add extra estimated income</b> and <b>deduct extra estimated expenses</b> for the rest of the year to fine-tune the projection.',
          'Pick the entity rate (25% MSME, 22% 115BAA, 15% 115BAB, 30% firm/other, or custom), add surcharge and 4% cess, less TDS credit and advance tax already paid  the instalment schedule (15 Jun/Sep/Dec/Mar) shows what to pay by each date.',
        ]},
        {type:'heading', text:'GST & TDS Returns'},
        {type:'steps', items:[
          '<b>GSTR-1</b>  generate the outward-supplies return with correct section logic: B2B (per-rate lines), B2CL (inter-state B2C over ₹1,00,000 - the reduced threshold), B2CS aggregated by place-of-supply + rate, exports, credit/debit notes (registered & unregistered), and HSN split into B2B / B2C. Export the <b>GSTN portal JSON</b> or the <b>Offline-Tool Excel</b> - a workbook whose sheets (b2b,sez,de / b2cl / b2cs / cdnr / cdnur / exp / exemp / hsn(b2b) / hsn(b2c) / docs) and column headers match the official GST Returns Offline Tool, so you can import it there directly.',
          '<b>GSTR-3B</b>  summary return with a books-vs-return reconciliation, ledger-based ITC (includes GST on expenses, not just purchase invoices), the correct ITC set-off order (Rule 88A / Sec 49A-49B), and portal JSON export.',
          '<b>GSTR-2B Recon.</b>  upload the portal 2B; match against your purchases and auto-book missing entries.',
          '<b>GST 3-Way Recon</b>  compares your <b>Books</b> (GST ledger postings) vs <b>GSTR-1</b> (from invoices) vs <b>GSTR-3B</b> (type in what you filed) side by side, and flags mismatches before you file - a books-vs-GSTR-1 gap usually means an invoice\'s tax never hit the GST ledgers.',
          '<b>GSTR-9 Annual</b>  yearly outward / ITC / tax summary.',
          '<b>TDS</b>  apply TDS on vouchers (with the 206AB higher-rate toggle for non-filers), and the TDS Report gives the deducted register + Form 26Q working.',
          '<b>HSN / SAC Rate Finder</b>  search GST 2.0 rates; the rate auto-fills when you type an HSN on an invoice line.',
        ]},
        {type:'heading', text:'MSME Dues - Sec 43B(h)'},
        {type:'text', text:'Tracks unpaid purchase bills owed to vendors you have tagged as MSME (fill the <b>MSME / Udyam Reg. No.</b> on the vendor master). Any amount overdue beyond the MSMED-Act limit (<b>45 days</b> with a written agreement, else 15) is <b>disallowed as a deduction u/s 43B(h)</b> until actually paid  clear these before 31-Mar to avoid the add-back. Toggle the 45/15-day limit and export to Excel.'},
        {type:'heading', text:'Startup Reliefs & ROC'},
        {type:'text', text:'A startup-focused panel: records your <b>incorporation date, DPIIT, Udyam, CIN</b> and angel-tax (Form-2) status, then shows which reliefs you likely qualify for  <b>DPIIT recognition, Sec 80-IAC 3-year tax holiday, Sec 56(2)(viib) angel-tax exemption, Sec 79 loss carry-forward, Udyam benefits</b>  plus a tickable <b>ROC / statutory annual-filing checklist</b> (INC-20A, ADT-1, AOC-4, MGT-7/7A, DPT-3, DIR-3 KYC, ITR). Informational  confirm eligibility with a professional.'},
      ]
    },
    registers: {
      title:'Registers  Ledger, Debtors & Vendor Statements',
      body: [
        {type:'text', text:'The Registers section provides detailed account-level and party-level statements  essential for day-to-day reconciliation, audit support, and sending balance confirmations to customers or vendors.'},
        {type:'heading', text:'Ledger Statement'},
        {type:'steps', items:[
          'Go to <b>Registers → Ledger Statement</b>.',
          'Select any <b>Chart of Accounts</b> account from the dropdown (all 40+ accounts available).',
          'Set the <b>From and To</b> date range  defaults to your financial year.',
          'The report shows: <b>Opening Balance</b> (computed from all transactions before the "From" date), then every transaction (Voucher No, Type, Narration, Dr, Cr) in date order, with a running balance column.',
          '<b>Closing Balance</b> row at the bottom with totals.',
          'Click <b>⬇ CSV</b> to export or <b>🖨 Print</b> for a hard copy.',
        ]},
        {type:'heading', text:'Debtors Statement'},
        {type:'steps', items:[
          'Go to <b>Registers → Debtors Statement</b>.',
          'Select a <b>Customer</b> from the dropdown (only parties with type Customer or Both are listed).',
          'Set the date range. The statement shows: Sales (SAL) as Debit, Receipts (REC) and Credit Notes (CRN) as Credit, with running outstanding balance.',
          'Click <b>Show Confirmation Letter</b>  a formal <b>Balance Confirmation Letter</b> is generated on your company\'s letterhead with the debtor\'s address, closing balance amount, and dual signature blocks (your authorised signatory + debtor\'s confirmation).',
          'Print the letter, get it signed by the debtor, and file it  required during statutory audit as third-party confirmation.',
        ]},
        {type:'heading', text:'Vendor Statement'},
        {type:'steps', items:[
          'Go to <b>Registers → Vendor Statement</b>.',
          'Select a <b>Vendor</b>. The statement shows: Purchases (PUR) as Credit (amount payable), Payments (PAY) and Debit Notes (DBN) as Debit.',
          'Click <b>Show Confirmation Letter</b> for a formal <b>Vendor Balance Confirmation</b> letter  same format as Debtors but styled for payables.',
          'Vendor confirmations are required by auditors for accounts payable verification.',
        ]},
        {type:'tip', text:'Run Debtors + Vendor Statements at year-end (31st March). Send confirmation letters to all parties with outstanding balances above your materiality threshold. File the signed copies with your CA.'},
      ]
    },
    inventory: {
      title:'Inventory Module  Stock Items & Stock Ledger',
      body: [
        {type:'text', text:'The Inventory Module tracks your physical stock  what came in, what went out, and what you have on hand. Enable the <b>Trader Module</b> in Company Settings to activate it.'},
        {type:'heading', text:'Setting Up Stock Items'},
        {type:'steps', items:[
          'Go to <b>Inventory → Stock Items</b>.',
          'Click <b>Add Item</b>  fill Item Code (unique), Item Name, Category, Unit of Measure, HSN/SAC code, and GST Rate.',
          '<b>Categories:</b> Raw Material, Semi-Finished, Finished Goods, Consumable, Packing Material, Trading Goods, Service.',
          'Set <b>Opening Qty</b> (stock on hand at the start of your accounting period) and <b>Opening Value</b> (for valuation).',
          'Set <b>Reorder Level</b>  the Stock Ledger will flag items in red when they fall below this threshold.',
        ]},
        {type:'heading', text:'How Stock Moves Automatically'},
        {type:'steps', items:[
          '<b>Purchase Voucher (PUR)</b> → Stock In: Add <b>Stock Lines</b> at the bottom of the voucher  select item, qty, rate. The purchase increases inventory.',
          '<b>Sales Voucher (SAL)</b> → Stock Out: Add Stock Lines similarly. The sale decreases inventory.',
          'Stock movements are recorded in the <b>stockLines[]</b> array on the voucher  separate from the accounting lines.',
        ]},
        {type:'heading', text:'Stock Ledger Report'},
        {type:'steps', items:[
          'Go to <b>Inventory → Stock Ledger</b>.',
          'Select a <b>Stock Item</b> and date range.',
          'See: Opening balance (qty), every In/Out movement with reference and narration, running balance qty.',
          '4 summary cards: Opening / Total In / Total Out / Closing Balance  closing shown in red if below reorder level.',
          'Export to CSV or Print.',
        ]},
        {type:'heading', text:'Inventory Movements'},
        {type:'text', text:'Go to <b>Inventory → Inventory Movements</b> for a consolidated log of ALL stock movements across ALL items  purchases, sales, production consumptions, and FG output. Filter by date, item, or movement type. CSV export available.'},
        {type:'tip', text:'The Inventory Module is physical quantity-based. For financial valuation (FIFO, weighted average), pass a Journal Voucher to adjust the Inventory account in the COA.'},
      ]
    },
    factory: {
      title:'Factory Module  BOM & Production Orders',
      body: [
        {type:'text', text:'The Factory Module is for manufacturing businesses. It tracks the conversion of Raw Materials into Finished Goods via Bill of Materials (BOM) and Production Orders. Enable the <b>Factory Module</b> in Company Settings to activate it.'},
        {type:'heading', text:'Bill of Materials (BOM)'},
        {type:'steps', items:[
          'Go to <b>Inventory → Bill of Materials</b>.',
          'Click <b>New BOM</b>.',
          'Select the <b>Finished Good item</b> (must have category = Finished Goods or Semi-Finished in Stock Items).',
          'Set the <b>Yield Qty</b>  how many units of FG this BOM produces per production run.',
          'Add <b>Components</b> (Raw Materials): select item + quantity required per yield. Repeat for all RM components.',
          'Click <b>Save BOM</b>. You can create multiple BOMs for different products.',
        ]},
        {type:'heading', text:'Production Orders'},
        {type:'steps', items:[
          'Go to <b>Inventory → Production Orders</b> and click <b>+ New Production Order</b>.',
          'Enter the <b>PO Number</b> (auto-generated as PO-0001, PO-0002...), date, and how many units of FG you want to produce.',
          'Select the <b>BOM</b>  the system immediately <b>auto-calculates RM consumption</b> quantities proportionally (e.g. if BOM yields 100 units and you order 250, all RM quantities are multiplied by 2.5).',
          'Select the <b>Finished Good item</b> (auto-filled from BOM).',
          'Click <b>Save Production Order</b>  it is created in <b>Draft</b> status.',
          'Review the consumption table and click <b>▶ Post</b>  status changes to <b>Posted</b> and stock quantities are updated: RM items are reduced, FG item is increased.',
        ]},
        {type:'heading', text:'How Production Feeds the Stock Ledger'},
        {type:'steps', items:[
          'When a Production Order is <b>Posted</b>, the system records a <b>Consumption</b> movement (Out) for each RM component in the Stock Ledger.',
          'The Finished Good item gets a <b>Production</b> movement (In) for the FG qty produced.',
          'These movements appear in both the <b>Stock Ledger</b> (item-wise) and <b>Inventory Movements</b> (consolidated log).',
        ]},
        {type:'tip', text:'For work-in-progress (WIP) accounting, pass a Journal Voucher: Dr WIP Account → Cr Raw Material Account when consuming RM, and Dr Finished Goods → Cr WIP when completing production. This maintains your Balance Sheet inventory values.'},
      ]
    },
    gstr1: {
      title:'GSTR-1  Outward Supplies Return',
      body: [
        {type:'text', text:'GSTR-1 is your statement of outward supplies  all sales invoices, credit/debit notes, and exports for the period. MiyeeBooks auto-generates it from your Sales vouchers with zero manual entry.'},
        {type:'heading', text:'Period Selection'},
        {type:'steps', items:[
          'Use the <b>Monthly / Quarterly (QRMP)</b> toggle at the top to switch between return modes.',
          'For <b>monthly</b>: pick the calendar month. For <b>QRMP</b>: select Q1 (Apr–Jun), Q2 (Jul–Sep), Q3 (Oct–Dec) or Q4 (Jan–Mar).',
          'All tables and totals update instantly for the selected period.',
        ]},
        {type:'heading', text:'Tables (Tabs)'},
        {type:'steps', items:[
          '<b>Table 4A  B2B</b>: Sales to registered GST customers. Shows GSTIN, place of supply, reverse charge flag, taxable value, IGST/CGST/SGST. Subtotal row at the bottom.',
          '<b>Table 5  B2CL</b>: Inter-state unregistered invoices with value <b>&gt; ₹2.5 lakh</b>. Auto-detected from vouchers where party has no GSTIN + is inter-state + invoice &gt; ₹2.5L.',
          '<b>Table 6A  Exports</b>: Foreign party sales (zero-rated). Marked EXPWOP (without payment). Shipping bill fields shown for manual entry.',
          '<b>Table 7  B2CS</b>: All other unregistered supplies  grouped by Place of Supply and GST Rate for portal-ready aggregate filing.',
          '<b>Table 9B  CDN</b>: Credit Notes and Debit Notes split into CDNR (registered) and CDNUR (unregistered) sub-tables.',
          '<b>Table 12  HSN</b>: HSN/SAC-wise summary with UQC, total value, taxable value, tax split. Grand total row included.',
          '<b>Summary tab</b>: One-page summary matching the actual GSTR-1 PDF format  table-wise record count and tax amounts.',
        ]},
        {type:'heading', text:'JSON Export for Portal Upload'},
        {type:'steps', items:[
          'Click <b>⬇ Export JSON</b> at the top right.',
          'A GSTN-compatible <code>gstr1.json</code> file is downloaded instantly.',
          'Log in to <b>gst.gov.in → Returns → GSTR-1 → Prepare Offline</b> → Upload this JSON.',
          'The JSON includes B2B, B2CS, Exports (EXP), CDNR, and HSN sections in the GSTN schema.',
        ]},
        {type:'tip', text:'Ensure every Sales voucher has a Place of Supply filled in  this drives IGST vs CGST+SGST and determines which B2C table the invoice falls into.'},
      ]
    },
    gstr3b: {
      title:'GSTR-3B  Monthly/Quarterly Summary Return',
      body: [
        {type:'text', text:'GSTR-3B is the consolidated summary return you file before paying GST. MiyeeBooks computes every table automatically from your vouchers and applies the correct ITC utilisation order as per CGST Rules.'},
        {type:'heading', text:'Period & Summary Cards'},
        {type:'steps', items:[
          'Use the <b>Monthly / Quarterly (QRMP)</b> toggle and picker at the top.',
          'Four cards show: <b>Output Tax Liability</b>, <b>ITC Available</b>, <b>ITC Utilised</b>, and <b>Net Cash to Pay</b> at a glance.',
        ]},
        {type:'heading', text:'Table 3.1  Outward Supplies'},
        {type:'text', text:'Five rows auto-populate: (a) Taxable outward  net of credit notes; (b) Zero-rated (exports); (c) Nil/Exempt; (d) Reverse charge inward; (e) Non-GST. Values are credit-note-adjusted automatically.'},
        {type:'heading', text:'Table 3.2  Interstate Supplies'},
        {type:'text', text:'Breaks down interstate taxable supplies from 3.1(a) into supplies to: Unregistered Persons, Composition Dealers, and UIN Holders  as required on the GSTN portal.'},
        {type:'heading', text:'Table 4  Eligible ITC'},
        {type:'steps', items:[
          '<b>Section A</b>  ITC Available: Import of goods (1), Import of services (2), RCM (3), ISD (4), All other ITC from purchase register (5).',
          '<b>Section B</b>  ITC Reversed: Rule 38/42/43, Section 17(5) blocked credits, others.',
          '<b>Section C</b>  Net ITC Available (A − B)  highlighted in green, feeds into the payment table.',
        ]},
        {type:'heading', text:'ITC Utilisation Order (Rule 88A)'},
        {type:'text', text:'MiyeeBooks applies the legal order: <b>1.</b> IGST ITC → IGST liability first → then CGST → then SGST. <b>2.</b> CGST ITC → CGST liability only. <b>3.</b> SGST ITC → SGST liability only. Each column in Table 6.1 shows exactly how much ITC was used from each source.'},
        {type:'heading', text:'Table 5 & 5.1'},
        {type:'text', text:'Table 5 captures nil/exempt and non-GST inward supplies (inter-state and intra-state). Table 5.1 shows interest and late fee payable for previous periods  enter manually if applicable.'},
        {type:'heading', text:'Table 6.1  Payment of Tax'},
        {type:'text', text:'Detailed payment table showing for each of IGST / CGST / SGST: Tax Payable, ITC used from IGST pool, ITC used from CGST pool, ITC used from SGST pool, and final Cash to Pay. Grand total row in green.'},
        {type:'tip', text:'If your IGST ITC exceeds IGST liability, the excess offsets CGST first, then SGST  this is the Rule 88A cross-utilisation and is built-in to MiyeeBooks.'},
      ]
    },
    gstr2b: {
      title:'GSTR-2B  ITC Reconciliation',
      body: [
        {type:'text', text:'GSTR-2B is the auto-drafted ITC statement generated by the GST portal from your suppliers\' filings. Reconciling it against your purchase register ensures every ITC claim is valid and defensible during audit.'},
        {type:'heading', text:'Loading Your GSTR-2B Data'},
        {type:'steps', items:[
          'Log in to <b>gst.gov.in → Returns → GSTR-2B</b>.',
          'Click <b>Download → JSON</b> (for full data) or <b>Export to Excel/CSV</b> (simpler format).',
          'In MiyeeBooks, select the period month and click <b>⬆ Upload 2B (JSON / CSV)</b>.',
          'The parser supports: <b>GSTN official JSON</b> (includes B2B, CDNR, ISD sections) and <b>portal CSV export</b> (with header row  auto-detects column names).',
          'Loaded records are stored in your local database and persist across sessions.',
          'Use <b>Clear [month]</b> to remove and re-upload if needed.',
        ]},
        {type:'heading', text:'5 Reconciliation Categories (Tabs)'},
        {type:'steps', items:[
          '<b>✓ Matched</b>  Invoice found in both books and 2B with same GSTIN + Invoice# + Amount (within ₹1). ITC is fully eligible. Total matched ITC shown in the header.',
          '<b>⚡ Amount Mismatch</b>  Same GSTIN and Invoice# but the value differs. Shows Books Total vs Portal Total with the difference. Action: check if you entered the wrong amount and correct your voucher.',
          '<b>⚠ Inv# Mismatch</b>  Same GSTIN + amount (within ₹10) but Invoice# differs. Likely a typo in your books. Action: update your voucher to match the portal invoice number.',
          '<b>⊘ Books Only  ITC at Risk</b>  You have the invoice in your books but it\'s NOT in GSTR-2B. The vendor may not have filed their GSTR-1 yet. ITC claimed here is <b>at risk of reversal</b>. Action: Follow up with vendor.',
          '<b>↓ 2B Only  Unclaimed ITC</b>  Invoice is in the portal 2B but missing from your books. You are leaving ITC unclaimed. Click <b>+ Book Entry</b> to see full details and create the purchase voucher.',
        ]},
        {type:'heading', text:'Summary Stats'},
        {type:'text', text:'The 6 stat cards at the top show: Purchase Register count, GSTR-2B records count, Matched count + eligible ITC, Issues count (amount+inv# mismatches), ITC at Risk (₹), and Unclaimed ITC (₹).'},
        {type:'heading', text:'Export & Reporting'},
        {type:'steps', items:[
          'Click <b>⬇ Export CSV</b> to download the full reconciliation with all 5 categories in one file.',
          'Share the CSV with your CA or auditor for ITC review.',
          'The export includes: Status, Vendor, GSTIN, Books Inv#, Portal Inv#, Date, Taxable, IGST, CGST, SGST, Books Total, Portal Total, Difference.',
        ]},
        {type:'tip', text:'Run GSTR-2B reconciliation every month BEFORE filing GSTR-3B. ITC claimed in 3B must match 2B  any excess can attract notices under Rule 36(4).'},
      ]
    },
    tds: {
      title:'TDS Module',
      body: [
        {type:'text', text:'Configure TDS sections with rates, thresholds, and linked payable ledgers. Apply TDS when posting expense/purchase vouchers.'},
        {type:'heading', text:'Setup'},
        {type:'steps', items:[
          'Go to <b>TDS Sections</b> → 10 common sections are pre-loaded (194C, 194J, 194I, 194H, 194A, 194Q, 192).',
          'Each section is linked to a <b>TDS Payable ledger</b> (e.g., "TDS Payable  194C Contractor").',
          'Edit rates if a deductee has a lower deduction certificate u/s 197.',
          'Add custom sections as needed.',
        ]},
        {type:'heading', text:'Deducting TDS on a Voucher'},
        {type:'steps', items:[
          'Create a <b>Purchase / JV / Payment</b> voucher.',
          'Check <b>"Apply TDS"</b> in the gold panel below the line items.',
          'Select the TDS section  rate and amount auto-calculate on the voucher value.',
          'You can override the TDS amount manually if needed.',
          'The system shows: TDS amount → linked payable ledger → net payable.',
        ]},
        {type:'heading', text:'TDS Deducted Report'},
        {type:'text', text:'Go to <b>TDS Deducted Report</b> for: section-wise summary, detailed register with date/party/section/amount, payroll TDS (u/s 192), and compliance notes with due dates.'},
      ]
    },
    hr: {
      title:'HR & Payroll',
      body: [
        {type:'heading', text:'Employee Master'},
        {type:'steps', items:[
          'Go to <b>Employee Master</b> → Click <b>+ Add Employee</b>.',
          'Fill personal details: code, name, PAN, Aadhaar, UAN, ESIC No., bank account.',
          '<b>Salary structure:</b> Set Basic, HRA, DA, Special Allowance.',
          '<b>Custom allowances:</b> Add any number of custom allowances (Conveyance, Medical, Food, etc.) with <b>+ Add Allowance</b>.',
          '<b>Statutory:</b> Toggle PF (12% on PF base), ESIC (0.75% employee if gross ≤ ₹21K), Professional Tax, TDS on salary.',
          'The summary card shows <b>Gross → Deductions → Net Pay → CTC</b> in real-time.',
        ]},
        {type:'heading', text:'Run Payroll'},
        {type:'steps', items:[
          'Select the <b>month</b> and click <b>Generate Payroll Preview</b>.',
          'Review the full breakdown  Gross, PF, ESIC, PT, TDS, Net for each employee.',
          'Click <b>Post Payroll JV</b> to create a Journal Voucher with all double-entry lines (Dr Salary, Cr PF/ESIC/PT/TDS/Net Payable).',
          'Employer PF (12%) and ESIC (3.25%) are also debited as employee benefit expenses.',
        ]},
        {type:'heading', text:'Payslips'},
        {type:'steps', items:[
          'Go to <b>Payslips</b> → Select the month.',
          'Click <b>⎙ Payslip</b> on any employee row.',
          'A formatted payslip opens in a new window with earnings, deductions, and net pay.',
          'Click <b>Print / Save PDF</b> to download.',
        ]},
        {type:'tip', text:'Payslips include your company logo and are formatted for A4 printing.'},
      ]
    },
    reports: {
      title:'Reports & MIS Analytics',
      body: [
        {type:'heading', text:'Registers (Ledger / Debtors / Vendor Statements)'},
        {type:'text', text:'The <b>Registers</b> section has three powerful statements: <b>Ledger Statement</b> (any account with running balance), <b>Debtors Statement</b> (customer-wise with balance confirmation letter), and <b>Vendor Statement</b> (vendor-wise with confirmation letter). See the dedicated Registers help section for full details.'},
        {type:'heading', text:'Trial Balance'},
        {type:'text', text:'All ledger accounts with opening balance, period movements (Dr/Cr), and closing balance. A balanced trial (total Dr = total Cr) confirms double-entry integrity. Filter by account type. Print or export for your CA.'},
        {type:'heading', text:'Profit & Loss  Schedule III'},
        {type:'text', text:'Vertical format per Companies Act Schedule III Division I: <b>Revenue from Operations</b> → Other Income → <b>Total Income</b> → Expenses (Cost of Materials, Employee Benefit, Finance Costs, Depreciation, Other Expenses) → <b>PBT</b> → Tax Provision → <b>PAT</b> → Basic EPS. Year-to-date and period view.'},
        {type:'heading', text:'Balance Sheet  Schedule III'},
        {type:'text', text:'Vertical format: <b>Equity & Liabilities</b> (Share Capital + Reserves, Non-Current Liabilities, Current Liabilities) vs <b>Assets</b> (Fixed Assets with gross/depreciation, Investments, Current Assets). Auto-verifies tallying  shows green ✓ if balanced.'},
        {type:'heading', text:'Cash Flow Statement  AS-3 (Indirect Method)'},
        {type:'text', text:'Starts with PBT, adds back non-cash items (depreciation, amortisation), adjusts for working capital changes (debtors, creditors, inventory), then separately shows Investing activities (asset purchases) and Financing activities (loans, capital). Reconciles to opening + closing cash+bank.'},
        {type:'heading', text:'CFO / MIS Dashboard'},
        {type:'text', text:'12 live KPI cards: Revenue YTD, Gross Profit, EBITDA, PAT, Net Margin, Cash Position, Trade Receivables, Trade Payables, GST Payable, DSO, DPO, and Current Ratio. Includes monthly revenue vs expense bar chart and expense category breakdown.'},
        {type:'heading', text:'Financial Ratios (27 Ratios)'},
        {type:'steps', items:[
          '<b>Profitability:</b> Gross Margin, EBITDA Margin, Net Margin, ROCE, ROE, ROA.',
          '<b>Liquidity:</b> Current Ratio, Quick Ratio, Cash Ratio, Operating Cash Flow Ratio.',
          '<b>Activity/Efficiency:</b> Inventory Turnover, Receivables Turnover, DSO, Payables Turnover, DPO, Asset Turnover.',
          '<b>Leverage/Solvency:</b> Debt-to-Equity, Interest Coverage, Debt Service Coverage, Net Debt/EBITDA.',
          '<b>MSME-Specific:</b> Working Capital Cycle, Revenue/Employee, Revenue Growth, Creditor Dependence.',
          'Each ratio shows: formula, computed value, industry benchmark, and a Green / Amber / Red status chip.',
        ]},
        {type:'heading', text:'Aging Analysis (AR & AP)'},
        {type:'text', text:'Receivables and Payables aging in 5 buckets: 0–30, 31–60, 61–90, 91–180, and 180+ days. Risk-flagged per party. Use this to chase overdue debtors and prioritise vendor payments.'},
        {type:'tip', text:'All reports include your company logo, name, and GSTIN in the header  ready for printing or sharing as PDF.'},
      ]
    },
    forex: {
      title:'Forex / Multi-Currency',
      body: [
        {type:'text', text:'Manage foreign currency transactions per AS-11. Set exchange rates, track exposure, and record forex gains/losses.'},
        {type:'steps', items:[
          'Update <b>exchange rates</b> on the Forex page (USD, EUR, GBP, AED, SGD, JPY).',
          'When creating a voucher for a foreign party, the <b>FX Rate field</b> appears automatically.',
          'Foreign exposure summary shows net open positions by currency with INR equivalent.',
          'At year-end, pass a <b>Journal Voucher</b> to revalue monetary items (receivables, payables, bank) at the RBI closing rate.',
        ]},
      ]
    },
    data: {
      title:'Backup & Sync',
      body: [
        {type:'heading', text:'Export / Import'},
        {type:'steps', items:[
          '<b>Export Full Backup (JSON)</b>  Downloads your entire database as a JSON file. Keep this safe.',
          '<b>Import from JSON</b>  Restore from a backup. This REPLACES all current data.',
          '<b>CSV exports</b>  Download Vouchers or COA as CSV for Excel analysis.',
          '<b>Data Integrity Check</b>  5 automated checks: orphan lines, balance, unique codes, GSTIN format, storage size.',
        ]},
        {type:'heading', text:'Google Drive Sync'},
        {type:'steps', items:[
          'Enter your <b>Google OAuth Client ID</b> (create at console.cloud.google.com).',
          'Set the <b>folder name</b> where backups will be stored.',
          'Click <b>Connect Google Drive</b> and authorize.',
          'Use <b>↑ Backup</b> and <b>↓ Restore</b> buttons. Enable <b>Auto-Sync</b> for automatic cloud backup on every change.',
          'The system detects <b>conflicts</b> (Drive newer than local) and lets you choose which version to keep.',
        ]},
        {type:'tip', text:'Take a JSON backup before any major operation. The Google Drive scope is "drive.file"  MiyeeBooks can only access files it creates.'},
      ]
    },
    shortcuts: {
      title:'Quick Reference',
      body: [
        {type:'heading', text:'GST Rates  Common Slabs'},
        {type:'steps', items:[
          '<b>0%</b>  Essential goods: fresh vegetables, milk, eggs, unbranded grains, books, printed maps.',
          '<b>5%</b>  Common use goods: sugar, edible oil, tea, coffee, spices, packed food, transport services.',
          '<b>12%</b>  Processed food, frozen meat, butter, cheese, mobile phones, textile.',
          '<b>18%</b>  Most services (IT, consulting, advertising, banking), FMCG, capital goods, chemicals.',
          '<b>28%</b>  Luxury/sin: automobiles, tobacco, aerated drinks, high-end electronics. <b>Cess</b> on select items.',
          '<b>GST Exemptions:</b> Health services, education, banking interest, agriculture produce, LUT exports.',
        ]},
        {type:'heading', text:'GST Compliance  Key Due Dates'},
        {type:'steps', items:[
          '<b>GSTR-1 (Monthly):</b> 11th of the following month.',
          '<b>GSTR-1 (QRMP Quarterly):</b> 13th of the month following the quarter.',
          '<b>GSTR-3B (Monthly):</b> 20th of the following month (large taxpayers). 22nd / 24th for small.',
          '<b>GSTR-3B (QRMP Quarterly):</b> 22nd / 24th of the month following the quarter.',
          '<b>GSTR-2B:</b> Auto-generated by portal on 14th of next month  download and reconcile before filing 3B.',
          '<b>GSTR-9 (Annual):</b> 31st December of the next financial year.',
        ]},
        {type:'heading', text:'TDS Quick Rates (FY 2025-26 / New Tax Regime)'},
        {type:'steps', items:[
          '<b>Sec 193 (194C)  Contractor:</b> 1% Individual/HUF · 2% Others · Threshold: ₹30K single / ₹1L annual.',
          '<b>Sec 194 (194J)  Professional:</b> 2% Technical services · 10% Other professional fees · Threshold: ₹30K.',
          '<b>Sec 194-I  Rent:</b> 2% Plant & Machinery · 10% Land/Building/Furniture · Threshold: ₹2.4L annual.',
          '<b>Sec 194H  Commission:</b> 5% · Threshold: ₹15K.',
          '<b>Sec 194A  Interest (non-bank):</b> 10% · Threshold: ₹40K (₹50K senior citizen).',
          '<b>Sec 194Q  Goods Purchase:</b> 0.1% on amount exceeding ₹50L from a single supplier.',
          '<b>Sec 192  Salary:</b> As per income tax slab. Employer to deduct monthly. Annual 26Q/24Q return.',
          '<b>TDS Deposit:</b> 7th of next month (March: 30th April). File 26Q/24Q quarterly.',
        ]},
        {type:'heading', text:'PF, ESIC & Professional Tax'},
        {type:'steps', items:[
          '<b>Provident Fund:</b> Employee 12% + Employer 12% on PF wages (max wage cap ₹15,000/month). Employer: 8.33% → EPS, 3.67% → EPF. Deposit by 15th of next month.',
          '<b>ESIC:</b> Employee 0.75% + Employer 3.25% on gross wages. Applicable if gross ≤ ₹21,000/month. Deposit by 15th.',
          '<b>Professional Tax (Gujarat):</b> ₹200/month on salary &gt; ₹12,000. February = ₹300. Annual max ₹2,500.',
          '<b>PT (Maharashtra):</b> Slab-based: ₹2,500/year for salary ≥ ₹10,001. State-specific slabs vary.',
        ]},
        {type:'heading', text:'Advance Tax Due Dates'},
        {type:'text', text:'<b>15 June</b>  15% of tax · <b>15 September</b>  45% cumulative · <b>15 December</b>  75% cumulative · <b>15 March</b>  100%. Applicable if total tax liability &gt; ₹10,000 in the year.'},
        {type:'heading', text:'GSTR-2B Reconciliation Statuses'},
        {type:'steps', items:[
          '<b>✓ Matched</b>  ITC fully safe. Same GSTIN + Invoice# + Amount in both books and portal.',
          '<b>⚡ Amount Mismatch</b>  Correct voucher amount; likely entered wrongly in your books.',
          '<b>⚠ Inv# Mismatch</b>  Correct inv# in your voucher to match portal record.',
          '<b>⊘ Books Only</b>  Vendor has NOT filed GSTR-1. Follow up before claiming ITC in 3B.',
          '<b>↓ 2B Only</b>  You have not booked this bill. Book entry to claim the ITC.',
        ]},
        {type:'heading', text:'ITC Blocked Credits (Section 17(5))'},
        {type:'text', text:'ITC is NOT available on: Motor vehicles (unless transport/driving school business), food & beverages, outdoor catering, beauty treatment, health services, works contract for immovable property, goods/services for personal consumption, and goods lost/destroyed/written off.'},
        {type:'tip', text:'When in doubt about ITC eligibility, consult your CA. Wrongly claimed ITC attracts 24% interest + penalty under CGST Act.'},
      ]
    },
    cost_dept: {
      title:'Cost Centres & Departments',
      body: [
        {type:'text', text:'Cost Centres and Departments let you tag every voucher journal line to a specific profit centre or team. This enables granular P&L reports, expense drill-downs, and budget enforcement  without needing separate company files.'},

        {type:'heading', text:'Cost Centres  Setup'},
        {type:'steps', items:[
          'Go to <b>Masters → Cost Centres</b> from the sidebar.',
          'Click <b>+ New Cost Centre</b>. Fill in the <b>Code</b> (e.g. CC-01), <b>Name</b> (e.g. "Manufacturing Unit"), and an optional Description.',
          'Set a <b>Budget (₹)</b> amount. Leave it at 0 if you do not want budget tracking for this centre.',
          'Choose <b>Budget Action</b>: <b>⚠ Warn Only</b> shows a confirmation popup when the budget is exceeded (you can still post). <b>🚫 Block Entry</b> prevents posting the voucher entirely until the budget allows.',
          'Set <b>Status</b> to Active. Inactive cost centres are hidden from voucher dropdowns.',
          'Click <b>💾 Save</b>. The cost centre is now available in all vouchers.',
        ]},

        {type:'heading', text:'Departments  Setup'},
        {type:'steps', items:[
          'Go to <b>Masters → Departments</b> from the sidebar.',
          'Click <b>+ New Department</b>. Fill in the <b>Code</b> (e.g. HR, MKT, OPS, FIN, SALES) and <b>Name</b>.',
          'Common departments: HR  Human Resources, MKT  Marketing, FIN  Finance, OPS  Operations, SALES  Sales, IT  Information Technology.',
          'Set Status to Active and save.',
        ]},

        {type:'heading', text:'Tagging Voucher Lines'},
        {type:'steps', items:[
          'Open any Voucher  Journal (JV), Purchase (PUR), Payment (PAY), Receipt (REC), etc.',
          'In the <b>Journal Lines</b> table, each row now has two extra dropdowns: <b>Cost Centre</b> and <b>Department</b>.',
          'Select the relevant Cost Centre and/or Department for each line. Both fields are <b>optional per line</b>  leave them blank for lines you do not need to track (e.g. the bank or creditor leg of an entry).',
          '<b>Typical tagging practice:</b> Tag the <b>expense/income line</b>, not the bank/payable/receivable line. Example: For a rent payment, tag the "Rent Expense" Dr line to Cost Centre CC-02 and Department OPS  leave the "Bank" Cr line untagged.',
          'Post the voucher normally. The Cost Centre and Department tags are stored with each line.',
        ]},

        {type:'heading', text:'Budget Enforcement'},
        {type:'steps', items:[
          'When you click <b>Post</b> on a voucher, MiyeeBooks automatically checks every tagged expense line against its cost centre\'s budget.',
          'The system sums <b>all previously posted expense entries</b> for that cost centre, adds the current entry, and compares against the budget.',
          'If the <b>projected spend exceeds the budget</b> and the cost centre is set to <b>⚠ Warn</b>: a confirmation dialog appears showing the overage details. Click OK to post anyway, or Cancel to revise.',
          'If the cost centre is set to <b>🚫 Block</b>: a red error toast appears and the voucher is NOT posted. You must reduce the amount, change the cost centre, or increase the budget before posting.',
          '<b>Edit-safe:</b> When editing an existing voucher, the system excludes that voucher from the "existing spend" calculation to prevent double-counting.',
          'Only <b>Expense-type account lines</b> are counted for budget purposes  income lines and balance sheet lines (bank, creditors, etc.) are ignored.',
        ]},

        {type:'heading', text:'Cost Centre P&L Report'},
        {type:'steps', items:[
          'Go to <b>Reports → Cost Centre P&L</b>.',
          'Set the <b>From</b> and <b>To</b> date range (defaults to your financial year).',
          'Optionally filter to a <b>single cost centre</b> using the dropdown.',
          'For each cost centre, you see: <b>Total Income</b> (credit lines on income accounts), <b>Total Expenses</b> (debit lines on expense accounts), and <b>Net P&L</b> (Income minus Expenses).',
          'If a budget is set, a <b>budget usage bar</b> shows: Amount spent / Budget with percentage. The bar turns amber above 80% and red when over budget.',
          'Below the summary, a <b>full transaction table</b> lists every tagged line: date, voucher number, account, type, debit, credit, and narration.',
          'Click <b>⬇ CSV</b> to export the summary or <b>🖨 Print</b> for a hard copy.',
        ]},

        {type:'heading', text:'Department Expense Report'},
        {type:'steps', items:[
          'Go to <b>Reports → Department Expenses</b>.',
          'Set date range and optionally filter to a single department.',
          'A <b>horizontal bar chart</b> at the top shows the expense distribution across all departments as a percentage of total  quick visual for cost allocation.',
          'For each department: a <b>breakdown by expense account</b> (shown as coloured chips) and the full transaction detail table below.',
          'Total department expenses appear in the card header for quick reference.',
          'CSV export available.',
        ]},

        {type:'tip', text:'Tag only the expense/income line in each entry  not the bank or party lines. This keeps your reports clean and avoids double-counting in budget calculations.'},
      ]
    },
    user_config: {
      title:'User Configuration  Multi-User Access',
      body: [
        {type:'text', text:'MiyeeBooks supports multi-user access via Firebase. The company owner can invite team members with different permission levels. Each user logs in with their own account and sees only the companies they have been granted access to.'},

        {type:'heading', text:'Prerequisites'},
        {type:'steps', items:[
          'Firebase must be configured for your MiyeeBooks instance (apiKey, projectId etc. filled in the source file).',
          'Firebase Authentication must have <b>Email/Password provider enabled</b> (Firebase Console → Authentication → Sign-in method).',
          'Your app\'s domain must be in <b>Authorized Domains</b> (Firebase Console → Authentication → Settings → Authorized domains).',
          'Firestore Security Rules must be updated to include the <b>invitations</b> and <b>sharedAccess</b> collections (see Company Settings → Firestore Rules section for the complete ruleset).',
          'A Firestore <b>composite index</b> is required on the <code>grants</code> collection group: <code>ownerId ASC + companyId ASC</code>, scope = Collection group. Create it from the Firestore Console → Indexes → Composite.',
        ]},

        {type:'heading', text:'User Roles Explained'},
        {type:'steps', items:[
          '<b>Owner</b>  The person who created the company. Has full access to everything including company settings and team management. Cannot be changed or revoked.',
          '<b>Admin</b>  Can read and write all data (vouchers, masters, employees, etc.). Can also manage team members  invite new users and revoke access. Cannot delete the company.',
          '<b>Limited</b> ��� Can read and write transaction data (vouchers, parties) but cannot access sensitive areas like payroll, TDS rates, or company settings.',
          '<b>Viewer</b>  Read-only access. Can see all reports and data but cannot create, edit, or delete anything. All action buttons are hidden. Ideal for auditors, silent partners, or CA reviewers.',
        ]},

        {type:'heading', text:'Inviting a Team Member'},
        {type:'steps', items:[
          'Go to <b>Masters → Team Members</b> from the sidebar.',
          'Click <b>+ Invite Member</b>.',
          'Select the <b>Role</b> (Admin / Limited / Viewer) from the dropdown.',
          'Click <b>Generate Invite Code</b>  an 8-character alphanumeric code is created and stored in Firestore.',
          'Click <b>📋 Copy Link</b>  this copies a direct link containing the invite code to your clipboard.',
          'Share the link (or just the code) with the team member via WhatsApp, email, or any channel.',
          'The invited person opens the link, logs in (or registers) with their email, and clicks <b>Join with Code</b> on the Company Selector screen.',
          'Once accepted, the company appears in their <b>Shared With Me</b> section on the Company Selector.',
        ]},

        {type:'heading', text:'Accepting an Invite'},
        {type:'steps', items:[
          'Open the invite link shared by the company owner, OR log in to MiyeeBooks normally.',
          'On the <b>Company Selector</b> screen, scroll to the bottom  you will see a <b>"Have an invite code?"</b> section.',
          'Type or paste the 8-character invite code and click <b>Join</b>.',
          'The company appears in your <b>Shared With Me</b> section. Click it to open the company.',
          'Your assigned role (Admin / Limited / Viewer) is shown in the top bar while you are working in that company.',
        ]},

        {type:'heading', text:'Managing Team Members (Admin View)'},
        {type:'steps', items:[
          'Go to <b>Team Members</b>  4 stat cards show: Total Users, Active Members, Pending Invites, Admins.',
          '<b>Active Members</b> table: shows each member\'s name, email, join date, invite code used, and role badge. Click <b>Revoke</b> (with confirmation) to remove a member\'s access immediately.',
          '<b>Pending Invites</b> table: shows unused invite codes with role, creation date, and expiry. Click <b>Cancel</b> to invalidate an unused code.',
          '<b>Role Permissions</b> table at the bottom summarises what each role can and cannot do.',
          'Revoking a member removes their Firestore grant document  they will no longer see the company on their next login.',
        ]},

        {type:'heading', text:'Firestore Security Rules'},
        {type:'steps', items:[
          'Go to <b>Company Settings</b> → scroll to the <b>Firestore Security Rules</b> card.',
          'Copy the complete ruleset shown there and paste it into your <b>Firebase Console → Firestore → Rules</b> tab.',
          'Click <b>Publish</b>. These rules ensure: owners can read/write their own company data, shared members can read (and non-viewers can write) shared company data, invite codes can be created and consumed by authenticated users, and grant documents are readable only by the member themselves.',
        ]},

        {type:'heading', text:'Switching Between Companies'},
        {type:'steps', items:[
          'Click <b>⇄ Switch Company</b> in the top-right corner of the app.',
          'The Company Selector reopens showing both your owned companies and companies shared with you.',
          'Click any company to switch to it. Your role badge in the top bar updates accordingly.',
        ]},

        {type:'tip', text:'Invite codes are single-use  once accepted, the code is marked as used and cannot be reused. Generate a new code for each person you want to invite.'},
      ]
    },
  };

  const cur = content[section] || content['overview'];

  const renderBlock = (block, i) => {
    if(block.type==='text') return <p key={i} style={{marginBottom:10,fontSize:13,lineHeight:1.7,color:'var(--ink-2)'}} dangerouslySetInnerHTML={{__html:block.text}} />;
    if(block.type==='heading') return <h3 key={i} style={{fontFamily:'var(--serif)',fontSize:17,fontWeight:600,color:'var(--ink)',margin:'18px 0 8px',paddingTop:10,borderTop:'1px solid var(--line)'}}>{block.text}</h3>;
    if(block.type==='steps') return (
      <div key={i} style={{margin:'8px 0 12px',paddingLeft:0}}>
        {block.items.map((item, j) => (
          <div key={j} style={{display:'flex',gap:10,marginBottom:6,fontSize:12.5,lineHeight:1.6,color:'var(--ink-2)'}}>
            <span style={{minWidth:22,height:22,borderRadius:'50%',background:'var(--primary)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0,marginTop:1}}>{j+1}</span>
            <span dangerouslySetInnerHTML={{__html:item}} />
          </div>
        ))}
      </div>
    );
    if(block.type==='tip') return (
      <div key={i} style={{margin:'10px 0',padding:'10px 14px',background:'var(--accent-soft)',border:'1px solid var(--accent)',borderRadius:8,fontSize:12,color:'var(--warning)'}}>
        <b>💡 Tip:</b> {block.text}
      </div>
    );
    return null;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Help & User Guide</h1>
          <div className="page-sub">MiyeeBooks MSME Accounting Suite · Complete module-wise guide</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:18}}>
        <div className="card" style={{alignSelf:'start',position:'sticky',top:10}}>
          <div className="card-body" style={{padding:'10px 0'}}>
            {sections.map(s => (
              <div key={s.id} className={'nav-item'+(section===s.id?' active':'')} onClick={() => setSection(s.id)} style={{padding:'7px 14px'}}>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">{cur.title}</h3>
          </div>
          <div className="card-body">
            {cur.body.map((block, i) => renderBlock(block, i))}
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:18}}>
        <div className="card-body" style={{textAlign:'center',padding:20}}>
          <p style={{fontSize:13,color:'var(--ink-2)',marginBottom:8}}>Need the full manual as a downloadable document?</p>
          <p style={{fontSize:11,color:'var(--ink-3)'}}>Export this guide from the Data Management page, or ask your administrator for the MiyeeBooks User Manual (DOCX).</p>
          <div style={{marginTop:12}}>
            <b style={{fontFamily:'var(--serif)',fontSize:16}}>Miyee·Books</b>
            <span style={{fontSize:11,color:'var(--ink-3)',marginLeft:8}}>Built by Vipin Nair · MYeeCFO Series</span>
          </div>
        </div>
      </div>
    </>
  );
}
