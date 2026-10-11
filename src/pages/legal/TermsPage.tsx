// /terms. Plain-language terms for a free student-made practice site. Not reviewed by a lawyer, and it says so.
import { Link } from "react-router-dom";
import { Bullets, LegalDoc, Mail, type LegalSection } from "./LegalDoc";

const sections: LegalSection[] = [
  {
    id: "what",
    title: "What DECA Masters is",
    body: (
      <>
        <p>
          DECA Masters is a free website for practising for DECA competitions:
          practice exams, vocab flashcards, a role-play trainer, and progress
          tracking. Two high school students in Ontario, Canada made it and run
          it.
        </p>
        <p>
          It is an independent project. It is not affiliated with, endorsed by,
          or sponsored by DECA Inc. or any DECA association, and nothing on it
          is official DECA material. Practice questions and vocab come from
          openly licensed sources, credited on each item and on the{" "}
          <Link to="/credits">credits page</Link>. Role-play practice links to
          DECA&apos;s own public samples instead of copying them. A score here
          does not predict a score at a competition.
        </p>
      </>
    ),
  },
  {
    id: "who",
    title: "Who can use it",
    body: (
      <>
        <p>
          Anyone can browse the public pages. To save progress you need an
          account, and the site is made for students in grades 7 to 12. If you
          are under 13, ask a parent or guardian before you make an account.
        </p>
        <p>
          Your login is shared with our FBLA practice site. These terms cover
          what you do on DECA Masters; the FBLA site has its own.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <Bullets>
        <li>One account per person. Keep your password to yourself.</li>
        <li>
          Pick a username and display name that are not rude, hateful, or
          pretending to be someone else, and that do not include contact details
          such as a phone number.
        </li>
        <li>
          If a name breaks these rules, or a member asks us to, the people who
          run the site can hide a profile from the leaderboard. Every such
          action is recorded with a reason.
        </li>
      </Bullets>
    ),
  },
  {
    id: "fair",
    title: "Use it fairly",
    body: (
      <>
        <p>Please do not:</p>
        <Bullets>
          <li>
            Use scripts, extra accounts or shared answers to climb the
            leaderboard.
          </li>
          <li>
            Try to get into someone else&apos;s account or data, or into the
            tools for the people who run the site.
          </li>
          <li>
            Overload, scrape, or attack the site, or get around its limits.
          </li>
          <li>Put anyone&apos;s personal information in feedback or notes.</li>
        </Bullets>
        <p>
          We may suspend an account that does these things. If we can, we will
          tell you why first.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Content and credit",
    body: (
      <>
        <p>
          Reused questions and terms stay under their own licences, such as
          Creative Commons licences, and each one names its source. If you reuse
          them, follow that licence and keep the credit. The{" "}
          <Link to="/credits">credits page</Link> lists every source.
        </p>
        <p>
          DECA and its event names and logos belong to DECA Inc. We use event
          names only to say what you are practising for.
        </p>
        <p>
          If a question, answer or credit is wrong, use &ldquo;Report this
          question&rdquo; or email <Mail />. We check reports against the source
          and fix or remove the item.
        </p>
      </>
    ),
  },
  {
    id: "yours",
    title: "What you send us",
    body: (
      <p>
        Your notes, goals and role-play ratings are yours; we store them so you
        can see them. When you send feedback or a report, you let us use it to
        improve the site. We do not publish it with your name.
      </p>
    ),
  },
  {
    id: "no-guarantees",
    title: "No guarantees",
    body: (
      <>
        <p>
          We try to keep the site accurate and running, but it is provided
          as it is. Questions can be wrong, features can change, and the site
          can be down, sometimes right before your competition. Check anything
          important against DECA&apos;s official guidelines.
        </p>
        <p>
          As far as the law allows, we are not responsible for losses that come
          from using the site, including competition results, lost progress, or
          relying on content that turns out to be wrong. Nothing in these terms
          takes away rights that the law says you cannot give up.
        </p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Stopping",
    body: (
      <p>
        You can stop using DECA Masters at any time, and email <Mail /> to
        delete your data, as the <Link to="/privacy">Privacy Policy</Link>{" "}
        explains. We may change or close the site; if we close it, we will try
        to give members notice on the site first.
      </p>
    ),
  },
  {
    id: "law",
    title: "Which laws apply",
    body: (
      <p>
        These terms follow the laws of Ontario and the federal laws of Canada
        that apply there.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        When we change these terms, we update the effective date at the top. For
        a big change, we will say so on the site before it takes effect. Using
        the site after that means you accept the new terms.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Use"
      lede="The deal for using DECA Masters, in plain language: what the site is, what it is not, and what we ask of you."
      summary={[
        "DECA Masters is a free, student-made practice site. It is not affiliated with or endorsed by DECA Inc.",
        "Questions come from openly licensed sources, credited on each item. A score here is practice, not a prediction.",
        "Be fair: one account each, no cheating the leaderboard, no poking at other people's data.",
        "The site is offered as it is, without guarantees. Ontario and Canadian law apply.",
        <>
          These terms have not been reviewed by a lawyer. Questions go to{" "}
          <Mail />.
        </>,
      ]}
      sections={sections}
      sibling={{ to: "/privacy", label: "Privacy Policy" }}
    />
  );
}
