import { Link } from "react-router-dom";
import { siteContact, whatsappUrl } from "../data/siteContact";

type LegalPageType = "accessibility" | "privacy" | "terms";

interface LegalPageProps {
  type: LegalPageType;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const linkClass = "text-[#f5f5f2] underline decoration-white/35 underline-offset-4 hover:decoration-white transition-colors";

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-t border-white/10 pt-8 md:pt-10">
      <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight text-[#f5f5f2] mb-4">{title}</h2>
      <div className="space-y-4 font-body text-sm md:text-[15px] leading-relaxed text-[#b7b7b2]">{children}</div>
    </section>
  );
}

function ContactDetails() {
  return (
    <p>
      Email <a className={linkClass} href={`mailto:${siteContact.email}`}>{siteContact.email}</a> or contact us on {" "}
      <a className={linkClass} href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp ({siteContact.whatsappDisplay})</a>.
    </p>
  );
}

function AccessibilityContent() {
  return (
    <>
      <Section title="Our commitment">
        <p>BANG PRIVATE TATTOOS is working to make this website usable for as many visitors as possible, including people who use assistive technology or have different access needs.</p>
      </Section>
      <Section title="Accessibility measures">
        <p>Current measures include keyboard-operable navigation and controls, visible focus treatment, semantic page structure and headings, form labels and validation feedback, readable color contrast, responsive layouts, and reduced-motion support where animations are present. Meaningful images are given alternative text where appropriate.</p>
      </Section>
      <Section title="Standards and feedback">
        <p>We use the Web Content Accessibility Guidelines (WCAG) as a reference while improving the usability and accessibility of this website. This statement does not represent a certification or a claim that every page meets a particular technical standard.</p>
        <p>If you encounter a barrier, need information in another format, or need help completing a booking, please contact us and tell us the page or feature involved. We will make reasonable efforts to provide the information or service through an accessible alternative where appropriate.</p>
        <ContactDetails />
      </Section>
      <Section title="Ongoing improvements">
        <p>Accessibility is an ongoing effort. We may update this website as we identify opportunities to improve the digital experience.</p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="Information we collect">
        <p>When you submit a booking request, we collect the information you provide in the form: your name, email address, WhatsApp number, city, requested service, preferred artist (if selected), tattoo idea, placement, and size. We also create a booking reference and may retain communications you send during the booking process. Please do not send unnecessary sensitive information through the form or WhatsApp.</p>
        <p>When analytics is configured, the site may also process a random visitor or session identifier, pages and meaningful events viewed, referrer information, campaign parameters, device and browser type, coarse country, state or region, city where available, and timestamps. We use Meta Pixel to measure page visits and successful booking leads; browser Pixel events do not include tattoo details, placement, size, email address, or phone number. We do not request precise GPS location.</p>
      </Section>
      <Section title="How we use information">
        <p>We use booking information to respond to tattoo inquiries, process consultation requests, identify the requested artist or service, discuss availability, scheduling, estimates, and tattoo requirements, provide customer support, maintain booking records, prevent fraud or abuse, operate and improve the website and services, and meet applicable legal obligations. First-party analytics may be used to understand website performance, advertising attribution, and booking conversion. A booking request is not an appointment confirmation.</p>
      </Section>
      <Section title="WhatsApp communications">
        <p>After submitting a booking request, you may choose to continue communication through WhatsApp. WhatsApp is operated by a third party, and its own privacy practices apply once you use that service. The current website sends only a booking reference and limited safe context in the WhatsApp handoff; it does not place your form details in the WhatsApp URL.</p>
      </Section>
      <Section title="Sharing and service providers">
        <p>Information may be processed by providers that help us run the booking workflow, host the site, or deliver a communication you choose to send. Current examples include Supabase for booking and database infrastructure, the website hosting provider, and WhatsApp/Meta for communications. Those providers handle information under their own terms and privacy practices. We may also disclose information when required by law or to protect rights, safety, and security.</p>
      </Section>
      <Section title="Selling or sharing personal information">
        <p>BANG PRIVATE TATTOOS does not sell booking information. Meta Pixel may be used to measure website visits and successful booking leads for advertising attribution. First-party analytics is used only for the purposes described above. If advertising, tracking, or sharing practices change, this policy must be updated before or when those practices are introduced.</p>
      </Section>
      <Section title="Retention and security">
        <p>We retain personal information only for as long as reasonably needed for booking, customer service, recordkeeping, security, legal, or legitimate business purposes. We use reasonable administrative, technical, and organizational safeguards designed to protect personal information, but no internet transmission or storage system is completely secure.</p>
      </Section>
      <Section title="Your choices and rights">
        <p>Depending on where you reside and where required by applicable law, you may have rights to access, correct, delete, or obtain a copy of personal information, or to limit or opt out of certain uses. To make a request, contact us using the details below. We may need to verify your request before acting on it. Privacy rights can vary by state and circumstances; this policy does not claim that any specific state privacy law applies to BANG PRIVATE TATTOOS.</p>
        <ContactDetails />
      </Section>
      <Section title="California privacy">
        <p>California residents may have additional rights under applicable California privacy law where BANG PRIVATE TATTOOS is subject to those requirements. Whether those requirements apply depends on facts and statutory thresholds that have not been assessed here. If required, a separate notice at collection should be displayed at or before personal information is collected.</p>
      </Section>
      <Section title="Children">
        <p>This website and booking form are not directed to children. Tattoo services are for adults 18 and older. We do not knowingly seek to collect personal information from children. If you believe a child has provided personal information, please contact us so we can review the request.</p>
      </Section>
      <Section title="Changes to this policy">
        <p>We may update this policy when our practices or applicable requirements change. The date at the top of this page shows when it was last updated.</p>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="Acceptance and eligibility">
        <p>By using this website or submitting a booking request, you agree to these Terms of Service and the Privacy Policy. Tattoo services are available only to individuals 18 and older as a BANG PRIVATE TATTOOS service policy. We may request valid government-issued photo identification and may decline a request where required by law, studio policy, health or safety considerations, or professional judgment.</p>
      </Section>
      <Section title="Booking requests and appointments">
        <p>Submitting a form or contacting us does not create or guarantee an appointment, artist-client relationship, or obligation to provide services. An appointment is confirmed only after the studio or artist communicates acceptance and any required scheduling or deposit requirements are completed. Requesting a particular artist does not guarantee that artist’s availability; another artist may be suggested where appropriate.</p>
      </Section>
      <Section title="Separate tattoo documents">
        <p>These website terms do not replace in-person consent forms, medical screening, state-required disclosures, artist releases or waivers, or local health-department requirements. Additional documents may be required before tattoo services are performed.</p>
      </Section>
      <Section title="Pricing, deposits, and payment">
        <p>Prices vary based on artist, size, placement, complexity, detail, and estimated time or session requirements. Website estimates and preliminary discussions are not a final price unless expressly confirmed. If a deposit is required, its amount, refundability, rescheduling conditions, and cancellation terms will be disclosed before payment; review those terms before paying. Available payment methods will be communicated during the booking process.</p>
      </Section>
      <Section title="Health, safety, and aftercare">
        <p>Tattooing involves piercing the skin and inherent risks, including pain or discomfort, bleeding, swelling, allergic or pigment reactions, infection, scarring, healing complications, and dissatisfaction with an aesthetic result. You are responsible for providing accurate information requested during consultation and reasonably following aftercare instructions from your artist. If symptoms suggest infection or another serious reaction, seek appropriate medical attention. This website does not provide medical advice.</p>
        <p>If you have a medical condition, take medication, are pregnant, have allergies, have a history of problematic scarring, or have concerns about whether tattooing is appropriate for you, consult a qualified healthcare professional before proceeding.</p>
      </Section>
      <Section title="Artist discretion and results">
        <p>Tattoos are handmade artistic services, and individual results vary with skin, placement, healing, aftercare, design, and other individual factors. Artists retain professional and creative discretion over designs, placement, technique, and whether to accept a proposed tattoo. They may recommend modifications to size, placement, detail, or composition for technical or artistic reasons. Photographs and examples are illustrative; healed results and individual experiences vary.</p>
      </Section>
      <Section title="Refusal of service">
        <p>We may refuse, postpone, modify, or discontinue a request when necessary for safety, hygiene, health concerns, intoxication, abusive behavior, inappropriate or unlawful requests, inability to verify age, legal or regulatory restrictions, unsuitable placement or skin conditions, or studio standards. Nothing in this section authorizes discrimination prohibited by applicable law.</p>
      </Section>
      <Section title="Home Call services">
        <p>BANG PRIVATE TATTOOS may accept inquiries for private, Home Call, travel, or off-site appointments. Availability depends on artist availability, location suitability, licensing requirements, health and sanitation requirements, venue requirements, and applicable federal, state, and local law. A request for Home Call or travel service does not guarantee that the service can legally or practically be provided at the requested location or time.</p>
      </Section>
      <Section title="Website content and third-party services">
        <p>Website content is provided for general information and may change without notice. To the extent BANG PRIVATE TATTOOS owns or is authorized to use original photography, designs, logos, text, graphics, or artist portfolios on this site, that content may not be copied, republished, or used commercially without permission. Links to third-party services, including WhatsApp and Instagram, are provided for convenience; their availability and practices are governed by their own terms.</p>
      </Section>
      <Section title="Website availability">
        <p>We do not guarantee uninterrupted, timely, secure, or error-free website or booking-system availability. We may change, suspend, or discontinue a website feature when reasonably necessary.</p>
      </Section>
      <Section title="Disclaimers and limitation of liability">
        <p>To the maximum extent permitted by applicable law, BANG PRIVATE TATTOOS is not responsible for indirect or consequential losses resulting solely from use of this website or third-party links. The website is provided “as is” and “as available,” without warranties that it will always be uninterrupted, secure, or error-free. Nothing in these terms excludes or limits liability, rights, or remedies that cannot lawfully be excluded or limited.</p>
      </Section>
      <Section title="Questions">
        <ContactDetails />
      </Section>
      <Section title="Changes to these terms">
        <p>We may update these Terms periodically. The date at the top of this page identifies the current version.</p>
      </Section>
    </>
  );
}

const pageDetails: Record<LegalPageType, { eyebrow: string; title: string; description: string }> = {
  accessibility: {
    eyebrow: "Accessibility",
    title: "Accessibility Statement",
    description: "Our ongoing effort to make the BANG PRIVATE TATTOOS website more accessible.",
  },
  privacy: {
    eyebrow: "Legal",
    title: "Privacy Policy",
    description: "How BANG PRIVATE TATTOOS handles information submitted through this website.",
  },
  terms: {
    eyebrow: "Legal",
    title: "Terms of Service",
    description: "Terms for using the BANG PRIVATE TATTOOS website and submitting a booking request.",
  },
};

export default function LegalPage({ type }: LegalPageProps) {
  const details = pageDetails[type];

  return (
    <main className="min-h-screen bg-[#111111] pt-28 md:pt-36 pb-20 md:pb-28" aria-labelledby="legal-page-title">
      <div className="max-w-[1040px] mx-auto px-5 md:px-8 lg:px-12">
        <Link to="/" className="inline-flex text-[10px] tracking-[0.2em] uppercase font-body text-[#858582] hover:text-[#f5f5f2] transition-colors mb-12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          ← Back to home
        </Link>
        <header className="max-w-3xl mb-14 md:mb-20">
          <p className="text-[10px] tracking-[0.3em] uppercase font-body text-[#858582] mb-4">{details.eyebrow}</p>
          <h1 id="legal-page-title" className="font-display text-5xl sm:text-6xl md:text-7xl leading-[0.9] uppercase tracking-tight text-[#f5f5f2]">{details.title}</h1>
          <p className="font-body text-sm md:text-base leading-relaxed text-[#b7b7b2] mt-6 max-w-2xl">{details.description}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase font-body text-[#858582] mt-6">Last updated: September 15, 2026</p>
        </header>
        <div className="max-w-3xl space-y-10 md:space-y-12">
          {type === "accessibility" && <AccessibilityContent />}
          {type === "privacy" && <PrivacyContent />}
          {type === "terms" && <TermsContent />}
        </div>
      </div>
    </main>
  );
}
