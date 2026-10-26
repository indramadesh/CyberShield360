"""Curated lesson library (original content, reviewed). Bump LIBRARY_VERSION when
editing so existing installs pick up the change on the next seed."""

LIBRARY_VERSION = 2

LESSONS: list[dict] = [
    # ---------------- Phishing ----------------
    {
        "slug": "phishing-basics", "category": "phishing", "difficulty": "beginner",
        "title": "Spotting Phishing",
        "summary": "Recognize fake messages that try to steal your login or OTP.",
        "objective": "Tell a phishing message from a genuine one before you click or reply.",
        "body": "Phishing is a message that pretends to come from someone you trust — a bank, a delivery company, "
                "your employer — so that you click a link, open an attachment or hand over a password or OTP. "
                "Attackers rely on urgency and fear (\"your account will be blocked\") because people who feel "
                "rushed don't stop to check.\n\nThe link is the giveaway in most cases. The name shown in a message "
                "can say anything; what matters is the real domain the link opens. A page that looks exactly like "
                "your bank's login but sits on an unfamiliar domain is a copy built to capture what you type.",
        "example": "An SMS says: \"Dear customer, your KYC has expired and your account will be suspended today. "
                   "Update now: http://kyc-verify-bank.example\". The bank's real domain isn't in the link, the message "
                   "creates a deadline, and it asks you to log in from a link.",
        "warning_signs": ["A deadline or threat (blocked, suspended, legal action)",
                          "A link whose real domain isn't the organisation's official one",
                          "Requests for a password, OTP, PIN or card details",
                          "Generic greetings and small spelling mistakes in the domain"],
        "prevention": ["Open the official app or type the website address yourself instead of using the link",
                       "Never share an OTP — no genuine organisation asks for it",
                       "Check the sender and the link's real domain before acting",
                       "Report the message and delete it"],
        "related": ["email-spoofing", "lookalike-domains", "otp-security"],
        "sources": [{"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in/"}],
    },
    {
        "slug": "lookalike-domains", "category": "phishing", "difficulty": "intermediate",
        "title": "Lookalike Domains and Fake Login Pages",
        "summary": "Read a link the way an attacker hopes you won't.",
        "objective": "Identify the registrable domain in any link and spot lookalikes.",
        "body": "Every web address has a registrable domain — the part an organisation actually owns, such as "
                "example.com in login.example.com. Everything to the left of it is chosen by whoever owns that "
                "domain. Attackers exploit this: sbi.secure-login.example belongs to secure-login.example, not SBI.\n\n"
                "Lookalikes swap similar characters (paypa1 for paypal, rn for m), add words (bank-verify-online), "
                "or use a different ending (.co instead of .com). Some use international characters that look "
                "identical to Latin letters; browsers may show these as 'xn--' punycode.",
        "example": "https://accounts.google.com.security-check.example/login — the real domain here is "
                   "security-check.example. The words 'accounts.google.com' are just a subdomain the attacker chose.",
        "warning_signs": ["The brand name appears, but not right before the final dot and ending",
                          "Swapped characters (0 for o, 1 for l, rn for m)",
                          "Extra words like verify, secure, update, support in the domain",
                          "A login page reached from a message rather than from the official app"],
        "prevention": ["Read the domain from right to left, starting at the ending (.com, .in)",
                       "Use bookmarks or the official app for banking and email",
                       "Let a password manager fill passwords — it won't fill them on a lookalike site",
                       "Scan doubtful links with CyberShield360 before opening them"],
        "related": ["phishing-basics", "password-managers"],
        "sources": [],
    },
    {
        "slug": "email-spoofing", "category": "phishing", "difficulty": "intermediate",
        "title": "Email Spoofing and Business Email Compromise",
        "summary": "Why the 'From' name proves nothing, and how payment fraud by email works.",
        "objective": "Check an email's real sender and verify payment requests out of band.",
        "body": "The display name in an email ('Accounts Team', your CEO's name) is free text. Even the address can "
                "be faked on poorly protected domains, and attackers often register lookalike domains or compromise "
                "real mailboxes.\n\nBusiness email compromise (BEC) is a targeted version: the attacker poses as a "
                "boss, supplier or client and asks for an urgent transfer, a change of bank details or gift cards. "
                "There's often no link or attachment at all — just a convincing request.",
        "example": "\"Hi, I'm in a meeting and can't talk. Please process a payment of ₹4,80,000 to our new vendor "
                   "today — details below. Keep this confidential.\" from ceo@company-mail.example.",
        "warning_signs": ["A Reply-To address different from the sender",
                          "Urgency plus secrecy ('don't tell anyone', 'I can't take calls')",
                          "A request to change bank details or pay a new account",
                          "A sender domain that is close to, but not, the real one"],
        "prevention": ["Verify payment or bank-detail changes by calling a number you already have",
                       "Inspect the full sender address and Reply-To, not just the name",
                       "Require two people to approve unusual payments",
                       "Report suspected BEC to your IT/security team immediately"],
        "related": ["phishing-basics", "social-engineering-basics"],
        "sources": [],
    },
    # ---------------- Passwords & authentication ----------------
    {
        "slug": "passwords-mfa", "category": "passwords", "difficulty": "beginner",
        "title": "Passwords & MFA",
        "summary": "Use unique passwords and turn on multi-factor authentication.",
        "objective": "Make account takeover hard even if one password leaks.",
        "body": "Websites get breached, and leaked passwords are tried automatically on other sites — this is "
                "called credential stuffing. If you reuse one password, one breach can unlock your email, "
                "shopping and social accounts.\n\nThe fix is two habits: a different password for every important "
                "account (a password manager makes this easy), and multi-factor authentication (MFA), which asks for "
                "a second proof such as an app code or a security key. With MFA on, a stolen password alone isn't enough.",
        "example": "A gaming forum you used years ago is breached. Attackers try the same email and password on a "
                   "popular email provider and get in, then reset your other accounts through that inbox.",
        "warning_signs": ["Using the same password on more than one site",
                          "Passwords based on names, birthdays or simple patterns",
                          "Login alerts you don't recognise",
                          "MFA turned off on your email account"],
        "prevention": ["Use a password manager to create and store unique passwords",
                       "Use long passphrases (four or more random words) where you must remember one",
                       "Turn on MFA — prefer an authenticator app or security key over SMS",
                       "Change a password immediately if a service reports a breach"],
        "related": ["password-managers", "mfa-fatigue", "account-recovery"],
        "sources": [],
    },
    {
        "slug": "password-managers", "category": "passwords", "difficulty": "beginner",
        "title": "Password Managers",
        "summary": "Let software remember strong, unique passwords for you.",
        "objective": "Understand how a password manager protects you, including from phishing.",
        "body": "A password manager stores your passwords in an encrypted vault protected by one strong master "
                "password (and ideally MFA). It generates long random passwords and fills them in for you, so "
                "you only need to remember one.\n\nA useful side effect: a manager fills a password only on the "
                "exact website it was saved for. On a lookalike phishing site it fills nothing — a strong hint "
                "that something is wrong.",
        "example": "You open a link to 'micr0soft-login.example'. Your password manager offers no saved login, so "
                   "you stop and check the address instead of typing your password.",
        "warning_signs": ["Your manager doesn't offer to fill a login you know you saved",
                          "A browser 'remember password' prompt on a site you didn't mean to visit",
                          "A master password you've used anywhere else"],
        "prevention": ["Choose a long, unique master password and turn on MFA for the vault",
                       "Let the manager generate passwords of 16+ characters",
                       "Treat 'no autofill' on a login page as a warning sign",
                       "Keep the manager and your devices updated"],
        "related": ["passwords-mfa", "lookalike-domains"],
        "sources": [],
    },
    {
        "slug": "mfa-fatigue", "category": "authentication", "difficulty": "intermediate",
        "title": "MFA Fatigue and OTP Relay Attacks",
        "summary": "How attackers get around two-factor authentication — and how to stop them.",
        "objective": "Recognise push-bombing and real-time OTP theft.",
        "body": "MFA stops most account takeovers, so attackers target the second step. In push-bombing (MFA "
                "fatigue) an attacker who has your password triggers login approvals again and again, hoping you "
                "tap 'Approve' to make them stop. In relay attacks a phishing site asks for your OTP and passes it "
                "to the real site within seconds.\n\nPhishing-resistant methods such as passkeys and hardware "
                "security keys check the website's real domain, so a relayed login fails.",
        "example": "At 2 a.m. your phone shows twelve 'Approve sign-in?' prompts. Then a caller claiming to be IT "
                   "support says the prompts are a glitch and asks you to approve the next one.",
        "warning_signs": ["Login approval prompts you didn't trigger",
                          "Someone asking you to read out or approve a code",
                          "A site asking for an OTP right after you entered a password from a link"],
        "prevention": ["Never approve a prompt you didn't start — deny it and change your password",
                       "Use number-matching prompts, passkeys or security keys where offered",
                       "Never share an OTP, even with someone claiming to be support",
                       "Report repeated prompts to your security team"],
        "related": ["passwords-mfa", "otp-security"],
        "sources": [],
    },
    {
        "slug": "account-recovery", "category": "authentication", "difficulty": "beginner",
        "title": "Securing Account Recovery",
        "summary": "Your recovery email and phone number are keys to your accounts.",
        "objective": "Lock down the paths attackers use to reset your passwords.",
        "body": "Whoever controls your recovery email or phone number can usually reset your other passwords. "
                "That makes your main email account the most important one you own, and SIM-swap fraud — where an "
                "attacker convinces a mobile operator to move your number to their SIM — a serious risk.\n\n"
                "Keep recovery options current, protect your email with strong MFA, and store backup codes safely.",
        "example": "Your phone suddenly shows 'No service'. Minutes later you get emails about password resets on "
                   "your bank and email accounts — signs of a SIM swap.",
        "warning_signs": ["Sudden loss of mobile signal without explanation",
                          "Password-reset emails you didn't request",
                          "Recovery email or phone changed without your action"],
        "prevention": ["Protect your email account with an authenticator app or security key",
                       "Save backup codes offline in a safe place",
                       "Ask your mobile operator about SIM-change protections",
                       "Contact your operator and bank immediately if you lose signal unexpectedly"],
        "related": ["passwords-mfa", "otp-security"],
        "sources": [],
    },
    # ---------------- Social engineering ----------------
    {
        "slug": "social-engineering-basics", "category": "social_engineering", "difficulty": "beginner",
        "title": "Social Engineering: Hacking People",
        "summary": "Pressure, authority and kindness are the attacker's tools.",
        "objective": "Recognise manipulation tactics in calls, chats and in person.",
        "body": "Social engineering means tricking people rather than computers. Attackers pose as officials, "
                "support staff or colleagues and use predictable levers: authority (\"this is the police\"), urgency "
                "(\"act now\"), fear (\"your account is involved in a crime\"), and helpfulness (\"can you just do "
                "me a quick favour?\").\n\nThe defence is a habit: pause and verify through a channel you choose — "
                "an official number, the official app, or a colleague you call yourself.",
        "example": "A video call from someone in a uniform claims your parcel contained drugs and you're under "
                   "'digital arrest'. They demand you stay on camera and transfer money to 'verify' your accounts. "
                   "Real police don't arrest people over video calls or ask for money transfers.",
        "warning_signs": ["Claims of authority you can't verify", "Pressure to act immediately or stay on the call",
                          "Requests for secrecy", "Payment requested to 'prove innocence' or 'secure' your money"],
        "prevention": ["Hang up and call back on an official number you looked up yourself",
                       "Never move money because a caller tells you to",
                       "Talk to someone you trust before acting on a frightening call",
                       "Report it at cybercrime.gov.in or call 1930"],
        "related": ["tech-support-scams", "phishing-basics"],
        "sources": [{"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in/"}],
    },
    {
        "slug": "tech-support-scams", "category": "social_engineering", "difficulty": "beginner",
        "title": "Fake Tech Support and Remote-Access Scams",
        "summary": "No real support team asks you to install AnyDesk for a refund.",
        "objective": "Refuse remote-access requests from unsolicited 'support' callers.",
        "body": "Tech-support scams start with a pop-up claiming your computer is infected, a fake 'customer care' "
                "number found in search results, or a caller offering a refund. The goal is to get you to install a "
                "remote-access app such as AnyDesk or TeamViewer. Once connected, the scammer can see your screen, "
                "open your banking app and move money while you watch a fake 'refund form'.",
        "example": "You search 'courier customer care' and call the first number. The agent says a refund of ₹10 is "
                   "pending and asks you to install a screen-sharing app and open your UPI app to 'receive' it.",
        "warning_signs": ["A pop-up with a phone number and alarming warnings",
                          "Being asked to install a screen-sharing or remote-access app",
                          "A 'refund' that requires you to open your banking or UPI app",
                          "Customer care numbers found in ads or random search results"],
        "prevention": ["Get support numbers only from the official website or app",
                       "Never install remote-access apps at a stranger's request",
                       "Close fake pop-ups; don't call the numbers they show",
                       "If connected already: disconnect, uninstall the app, call your bank"],
        "related": ["social-engineering-basics", "upi-safety"],
        "sources": [],
    },
    # ---------------- Payments ----------------
    {
        "slug": "upi-safety", "category": "upi", "difficulty": "beginner",
        "title": "UPI Safety",
        "summary": "Understand why you never share a UPI PIN to RECEIVE money.",
        "objective": "Know exactly which UPI actions move money out of your account.",
        "body": "A UPI PIN authorises a payment from your account. Receiving money never needs your PIN, a QR scan "
                "or an 'approve' tap. Scammers exploit this misunderstanding with collect requests (\"approve to "
                "receive ₹5,000\") and fake refunds.\n\nAlso watch for fake payment screenshots and SMS messages "
                "that look like credit alerts — always check your actual bank balance.",
        "example": "A buyer on a marketplace says they've sent the payment and you just need to 'accept' a request "
                   "in your UPI app. The request is a collect request — approving it with your PIN sends money to them.",
        "warning_signs": ["Any request to enter your UPI PIN to receive money",
                          "Collect requests from people you were expecting to pay you",
                          "Screenshots or SMS 'proof' of payment instead of a real credit",
                          "Pressure to complete the step quickly"],
        "prevention": ["Remember: PIN = money leaves your account",
                       "Decline unexpected collect requests",
                       "Verify credits in your bank app, not by screenshots",
                       "Report fraud immediately on 1930 or cybercrime.gov.in"],
        "related": ["qr-safety", "otp-security"],
        "sources": [{"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in/"}],
    },
    {
        "slug": "qr-safety", "category": "qr", "difficulty": "beginner",
        "title": "QR Code Safety",
        "summary": "Check what a QR code actually does before you act on it.",
        "objective": "Treat a QR code as an unknown link or payment request until checked.",
        "body": "A QR code is just text — usually a link or a payment request — that you can't read with your eyes. "
                "Scammers stick fake QR codes over real ones on parking meters and shop counters, send QR codes for "
                "'refunds', or put them in emails to get around link scanners.\n\nScanning a payment QR and entering "
                "your PIN always sends money. A QR that opens a login page deserves the same suspicion as a link in "
                "a message.",
        "example": "A seller sends a QR code saying 'scan this to receive your refund of ₹2,000'. Scanning it opens a "
                   "payment screen — approving it would debit you.",
        "warning_signs": ["A QR code offered to 'receive' money", "Stickers placed over an existing QR code",
                          "A QR code that opens a login page", "QR codes in unexpected emails or letters"],
        "prevention": ["Preview the destination before opening it (CyberShield360 can decode and check it)",
                       "Check the payee name before paying",
                       "Never enter a PIN to receive money",
                       "Prefer typing a known website address over scanning"],
        "related": ["upi-safety", "lookalike-domains"],
        "sources": [],
    },
    {
        "slug": "otp-security", "category": "upi", "difficulty": "beginner",
        "title": "OTPs: The Code You Never Share",
        "summary": "A one-time password is a signature — treat it like one.",
        "objective": "Understand what an OTP authorises and why callers want it.",
        "body": "One-time passwords confirm a specific action: a login, a payment, a change of phone number. Banks, "
                "telecom operators and delivery companies will never call you to ask for one. If someone asks for an "
                "OTP, they are trying to complete an action in your name — often a payment or an account takeover.\n\n"
                "Always read the full OTP message: it usually says what the code is for. If it says 'payment of "
                "₹24,999' and you aren't buying anything, someone else is.",
        "example": "A caller from 'the electricity board' says your connection will be cut tonight unless you verify "
                   "a code they just sent. The SMS actually reads: 'OTP to add a new beneficiary to your account'.",
        "warning_signs": ["Anyone asking you to read out a code",
                          "OTP messages for actions you didn't start",
                          "A caller who already knows some of your details (to seem genuine)"],
        "prevention": ["Never share an OTP with anyone, for any reason",
                       "Read what the OTP message says it authorises",
                       "If you get unexpected OTPs, change your password and alert your bank"],
        "related": ["upi-safety", "mfa-fatigue"],
        "sources": [],
    },
    # ---------------- Scams ----------------
    {
        "slug": "job-scams", "category": "jobs", "difficulty": "beginner",
        "title": "Fake Jobs and 'Task' Scams",
        "summary": "Real employers never ask you to pay to work.",
        "objective": "Spot recruitment and task-based earning scams.",
        "body": "Job scams promise easy money: liking videos, rating hotels or 'simple online tasks'. Early tasks pay "
                "small amounts to build trust, then you're asked to 'prepay' larger tasks or a 'registration fee', "
                "and the money is never returned. Other versions offer jobs abroad in exchange for visa or training "
                "fees, or collect your documents for identity fraud.",
        "example": "A WhatsApp message offers ₹3,000 a day for liking YouTube videos. After two small payments, you're "
                   "added to a Telegram group and told to deposit ₹10,000 to unlock 'VIP tasks'.",
        "warning_signs": ["Unsolicited offers via WhatsApp or Telegram", "Pay that's too high for very easy work",
                          "Any fee to register, train or unlock tasks", "Interviews only over chat, with no real company"],
        "prevention": ["Never pay to get a job or unlock work",
                       "Verify the company on its official website and careers page",
                       "Don't share ID documents until you've verified the employer",
                       "Report the number and group on the platform and at cybercrime.gov.in"],
        "related": ["investment-scams", "social-engineering-basics"],
        "sources": [],
    },
    {
        "slug": "investment-scams", "category": "investment", "difficulty": "intermediate",
        "title": "Investment and Trading App Scams",
        "summary": "Guaranteed high returns are the oldest red flag.",
        "objective": "Recognise fake trading platforms and pump-and-dump groups.",
        "body": "Investment scams lure people into groups where 'experts' share tips and screenshots of huge profits. "
                "Victims are directed to a trading app or website that shows a growing balance — but it's just numbers "
                "on a screen. Withdrawals are blocked by 'taxes' or 'fees', and the platform eventually disappears.\n\n"
                "Legitimate investments in India go through registered intermediaries; claims of guaranteed returns "
                "are a warning sign.",
        "example": "A stock-tips group invites you to an 'institutional account' app. Your ₹50,000 shows as ₹2,00,000 "
                   "within weeks, but to withdraw you must first pay a 20% 'tax'.",
        "warning_signs": ["Guaranteed or very high returns", "Apps installed from links instead of official stores",
                          "Fees required before you can withdraw", "Pressure to invest more quickly"],
        "prevention": ["Use only registered brokers and official app stores",
                       "Be sceptical of tips from strangers in chat groups",
                       "If you can't withdraw without paying more, stop and report it",
                       "Report to 1930 and your bank immediately"],
        "related": ["job-scams", "social-engineering-basics"],
        "sources": [],
    },
    # ---------------- Malware & ransomware ----------------
    {
        "slug": "malware-basics", "category": "malware", "difficulty": "beginner",
        "title": "Malware: What It Is and How It Gets In",
        "summary": "Most infections start with something you were persuaded to open or install.",
        "objective": "Know the common ways malware reaches a device and how to block them.",
        "body": "Malware is software built to harm you: stealing passwords (infostealers), spying, encrypting files "
                "for ransom, or using your device in a botnet. It usually arrives through a disguised attachment, a "
                "fake software download or 'crack', a malicious app from outside the official store, or an "
                "unpatched vulnerability.\n\nKeeping software updated and installing only from trusted sources "
                "blocks most of it.",
        "example": "A 'free' cracked version of paid software comes with an infostealer that quietly uploads saved "
                   "browser passwords and session cookies to the attacker.",
        "warning_signs": ["Pirated software, cracks and 'keygens'", "Attachments that ask you to enable macros or content",
                          "Apps requesting permissions unrelated to what they do", "Sudden slowness, pop-ups or unknown programs"],
        "prevention": ["Install software only from official sources and stores",
                       "Turn on automatic updates for your OS, browser and apps",
                       "Don't enable macros in documents you didn't expect",
                       "Use reputable security software and scan suspicious files"],
        "related": ["ransomware-basics", "android-app-safety"],
        "sources": [],
    },
    {
        "slug": "ransomware-basics", "category": "ransomware", "difficulty": "intermediate",
        "title": "Ransomware and Backups",
        "summary": "When files are encrypted for ransom, backups are what save you.",
        "objective": "Understand how ransomware works and prepare to recover without paying.",
        "body": "Ransomware encrypts files and demands payment for the key; many groups also steal data and threaten "
                "to publish it. Attacks often begin with phishing, stolen remote-access passwords or unpatched "
                "internet-facing systems.\n\nThe most reliable defence is the 3-2-1 backup habit — three copies, on "
                "two kinds of storage, one kept offline or separate — together with patching and strong MFA on remote access.",
        "example": "A small office's shared drive is encrypted overnight. Because a weekly backup sits on a drive that's "
                   "disconnected after each backup, they restore everything except one day's work.",
        "warning_signs": ["Files suddenly renamed with new extensions", "Ransom notes in folders",
                          "Unusual remote logins at odd hours", "Security tools disabled unexpectedly"],
        "prevention": ["Keep offline or immutable backups and test restoring them",
                       "Patch internet-facing systems quickly",
                       "Protect remote access (VPN, RDP) with MFA",
                       "Disconnect infected machines and report the incident to CERT-In / your IT team"],
        "related": ["malware-basics", "incident-response-basics"],
        "sources": [{"label": "CERT-In", "url": "https://www.cert-in.org.in/"}],
    },
    {
        "slug": "android-app-safety", "category": "mobile", "difficulty": "beginner",
        "title": "Mobile App Safety",
        "summary": "An APK sent over chat can take over your phone.",
        "objective": "Install apps safely and recognise dangerous permissions.",
        "body": "Malicious Android apps are often sent as APK files over WhatsApp or SMS, disguised as a bank app, a "
                "wedding invitation, an electricity bill or a government scheme. Once installed and granted "
                "permissions such as reading SMS or accessibility access, they can intercept OTPs and control the phone.",
        "example": "A message from an unknown number: 'Your electricity bill is unpaid — install this app to pay and "
                   "avoid disconnection' with an attached .apk file.",
        "warning_signs": ["App files (.apk) sent in chats or SMS", "Requests to allow 'install from unknown sources'",
                          "Apps asking for SMS, accessibility or device-admin permissions",
                          "Battery drain, unknown apps or settings changing by themselves"],
        "prevention": ["Install apps only from the official app store",
                       "Keep 'install unknown apps' turned off",
                       "Review permissions and deny those an app doesn't need",
                       "Keep your phone's OS and apps updated"],
        "related": ["malware-basics", "otp-security"],
        "sources": [],
    },
    # ---------------- Web, network, cloud ----------------
    {
        "slug": "https-and-browsing", "category": "web_security", "difficulty": "beginner",
        "title": "HTTPS, the Padlock and Safe Browsing",
        "summary": "The padlock means the connection is private — not that the site is honest.",
        "objective": "Interpret browser security signals correctly.",
        "body": "HTTPS encrypts the connection between your browser and a website, so others on the network can't read "
                "or change what you send. It does not tell you who runs the site: phishing sites routinely use HTTPS "
                "too. So the padlock is necessary for logging in or paying, but never sufficient.\n\nWhat matters "
                "most is the domain name. Browser warnings about unsafe or deceptive sites should be taken seriously.",
        "example": "https://secure-payment-verify.example shows a padlock and a perfect copy of a bank page — but the "
                   "domain belongs to an attacker.",
        "warning_signs": ["Treating the padlock as proof a site is safe",
                          "Login or payment pages on plain http://",
                          "Ignoring full-page browser security warnings"],
        "prevention": ["Check the domain, not just the padlock",
                       "Never enter passwords or card details on http:// pages",
                       "Heed browser and CyberShield360 warnings",
                       "Keep your browser updated"],
        "related": ["lookalike-domains", "public-wifi"],
        "sources": [],
    },
    {
        "slug": "public-wifi", "category": "network_security", "difficulty": "beginner",
        "title": "Public Wi-Fi and Home Router Security",
        "summary": "Open networks and default router passwords are easy targets.",
        "objective": "Use public networks safely and secure your home router.",
        "body": "On public Wi-Fi, anyone nearby could set up a network with a convincing name ('Airport_Free_WiFi') "
                "to watch traffic or show fake login pages. HTTPS protects most traffic today, but avoid sensitive "
                "tasks on unknown networks and use mobile data when in doubt.\n\nAt home, routers ship with default "
                "admin passwords and sometimes outdated firmware; attackers scan the internet for them.",
        "example": "A café has two networks: 'CoffeeHouse' and 'CoffeeHouse_Free'. The second is run from a laptop "
                   "in the corner and shows a 'log in with your email password' page.",
        "warning_signs": ["Captive portals asking for email or social media passwords",
                          "Duplicate network names in one place",
                          "A router still using the default admin password"],
        "prevention": ["Prefer mobile data or a trusted VPN for sensitive tasks on public Wi-Fi",
                       "Change your router's admin password and use WPA2/WPA3",
                       "Update router firmware and turn off remote administration",
                       "Forget public networks after use"],
        "related": ["https-and-browsing"],
        "sources": [],
    },
    {
        "slug": "cloud-account-security", "category": "cloud", "difficulty": "intermediate",
        "title": "Cloud Storage and Shared Links",
        "summary": "A shared link set to 'anyone' can be found by anyone.",
        "objective": "Share cloud files safely and protect cloud accounts.",
        "body": "Cloud drives make sharing easy — sometimes too easy. Links set to 'anyone with the link' can be "
                "forwarded, indexed or guessed, exposing ID documents, invoices or customer data. Attackers also send "
                "fake 'document shared with you' emails that lead to credential-stealing pages.",
        "example": "An HR folder with employees' PAN and Aadhaar scans is shared with 'anyone with the link' for a "
                   "one-off task and never restricted again.",
        "warning_signs": ["'Anyone with the link' on sensitive files",
                          "Unexpected 'shared a document with you' emails asking you to log in",
                          "Old shares nobody reviews"],
        "prevention": ["Share with named people and set expiry dates",
                       "Review and remove old shares regularly",
                       "Turn on MFA for cloud accounts",
                       "Open shared-document notifications from the app, not the email link"],
        "related": ["privacy-basics", "passwords-mfa"],
        "sources": [],
    },
    # ---------------- Privacy & law ----------------
    {
        "slug": "privacy-basics", "category": "privacy", "difficulty": "beginner",
        "title": "Protecting Your Personal Data",
        "summary": "Less shared, less to misuse.",
        "objective": "Reduce the personal data that can be used to scam or impersonate you.",
        "body": "Scammers build convincing stories from small pieces of public information: your phone number, "
                "employer, family names, travel plans. Copies of ID documents shared casually can be reused for "
                "loans, SIM cards or accounts in your name.\n\nShare only what's needed, mask ID numbers where "
                "allowed, and review privacy settings on social media.",
        "example": "A caller knows your name, bank and the last four digits of your card — collected from a leaked "
                   "database and your social profile — and uses them to sound like the bank.",
        "warning_signs": ["Requests for ID copies without a clear reason",
                          "Public profiles listing phone number, birthday and workplace",
                          "Apps asking for contacts or location they don't need"],
        "prevention": ["Share ID copies only when required, and write the purpose on them",
                       "Use masked Aadhaar where accepted",
                       "Tighten social media privacy settings",
                       "Remember that knowing your details doesn't prove a caller is genuine"],
        "related": ["dpdp-rights", "cloud-account-security"],
        "sources": [],
    },
    {
        "slug": "dpdp-rights", "category": "cyber_law", "difficulty": "intermediate",
        "title": "Your Rights Under India's Data Protection Law",
        "summary": "An introduction to the Digital Personal Data Protection Act, 2023.",
        "objective": "Know the main rights and duties the DPDP Act describes.",
        "body": "The Digital Personal Data Protection Act, 2023 sets rules for organisations ('data fiduciaries') that "
                "process digital personal data. It describes rights for individuals ('data principals'), including "
                "the right to information about processing, correction and erasure, grievance redressal and "
                "nominating someone to exercise rights. Consent must be free, specific, informed and withdrawable, "
                "and a Data Protection Board of India handles complaints.\n\nProvisions come into force on dates the "
                "Government notifies, so check the Cyber Law Tracker and official sources for what applies now. "
                "This lesson is general information, not legal advice.",
        "example": "An app asks to access your contacts 'to improve services'. Under the Act, consent should be "
                   "specific to a stated purpose, and you should be able to withdraw it as easily as you gave it.",
        "warning_signs": ["Consent bundled into unrelated terms", "No clear way to withdraw consent",
                          "No contact for grievances"],
        "prevention": ["Read what you're consenting to and for which purpose",
                       "Use the organisation's grievance channel first if something goes wrong",
                       "Check the official text for which provisions are in force"],
        "related": ["privacy-basics", "it-act-basics"],
        "sources": [],
    },
    {
        "slug": "it-act-basics", "category": "cyber_law", "difficulty": "intermediate",
        "title": "Cybercrime and the IT Act: What You Can Report",
        "summary": "Common cyber offences and where to report them in India.",
        "objective": "Know that common online frauds are crimes and how to report them.",
        "body": "The Information Technology Act, 2000 (amended in 2008) covers offences such as hacking and data "
                "theft, identity theft (section 66C), cheating by impersonation using a computer resource (section "
                "66D) and publishing obscene material. Many frauds are also offences under general criminal law.\n\n"
                "Victims can report at the National Cyber Crime Reporting Portal (cybercrime.gov.in) or call the 1930 "
                "helpline — especially quickly after financial fraud, so banks can try to stop the money. This is "
                "general information, not legal advice.",
        "example": "Someone creates a fake profile with your photos and asks your friends for money. That's "
                   "impersonation — report it to the platform and at cybercrime.gov.in.",
        "warning_signs": ["Believing small frauds 'aren't worth reporting'",
                          "Waiting days before reporting a financial fraud"],
        "prevention": ["Report financial fraud to 1930 as soon as possible",
                       "Keep evidence: screenshots, transaction IDs, numbers, links",
                       "File a complaint at cybercrime.gov.in"],
        "related": ["incident-response-basics", "dpdp-rights"],
        "sources": [{"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in/"}],
    },
    # ---------------- AI & incident response ----------------
    {
        "slug": "ai-scams", "category": "ai_security", "difficulty": "intermediate",
        "title": "AI Voice Clones and Deepfake Scams",
        "summary": "A familiar voice on the phone is no longer proof of identity.",
        "objective": "Verify urgent requests even when the voice or face seems familiar.",
        "body": "Generative AI can imitate a person's voice from a short recording and create convincing video. "
                "Scammers use this to call parents pretending to be a child in trouble, or to pose as executives on "
                "video calls asking for urgent transfers. The emotional pressure is the point.\n\nAgree on a family "
                "'safe word', and always verify by calling back on a number you already know.",
        "example": "A late-night call: your nephew's voice, crying, says he's been arrested and needs ₹50,000 for bail "
                   "right now — and begs you not to tell his parents.",
        "warning_signs": ["Emergencies that demand money immediately", "Requests for secrecy",
                          "Payment by gift cards, crypto or to unfamiliar accounts",
                          "Video with odd lip-sync or unnatural blinking"],
        "prevention": ["Hang up and call the person back on their known number",
                       "Use a family safe word for emergencies",
                       "Limit public videos and voice clips where possible",
                       "Report impersonation attempts"],
        "related": ["social-engineering-basics", "email-spoofing"],
        "sources": [],
    },
    {
        "slug": "incident-response-basics", "category": "incident_response", "difficulty": "beginner",
        "title": "What To Do If You've Been Scammed",
        "summary": "The first hour matters most.",
        "objective": "Take the right steps, in the right order, after a scam.",
        "body": "If you've lost money, speed matters: call 1930 (India's cyber-crime helpline) and your bank's official "
                "number immediately, so the transaction can be flagged. Then secure your accounts — change passwords "
                "starting with email, sign out other sessions, and turn on MFA. If you installed an app or gave remote "
                "access, disconnect the device from the internet and remove it.\n\nKeep evidence (screenshots, "
                "transaction IDs, phone numbers, links) and file a complaint at cybercrime.gov.in. Being scammed is "
                "nothing to be ashamed of — reporting helps others too.",
        "example": "You shared an OTP and ₹15,000 left your account. You call 1930 within minutes, then your bank to "
                   "block the card, change your banking password, and file a complaint with the transaction ID.",
        "warning_signs": ["'Recovery agents' who promise to get money back for a fee — another scam"],
        "prevention": ["Call 1930 and your bank first", "Change passwords, starting with your email",
                       "Remove remote-access apps and unknown apps", "Report at cybercrime.gov.in with evidence"],
        "related": ["it-act-basics", "tech-support-scams"],
        "sources": [{"label": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in/"}],
    },
]
