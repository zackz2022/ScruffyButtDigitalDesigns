document.addEventListener("DOMContentLoaded", () => {

  const customerEmail = "misshannah@scruffybuttdigitaldesigns.com";

  const openEmailRequest = (subject, fields) => {
    const body = fields
      .map(({ label, value }) => `${label}: ${value || "Not provided"}`)
      .join("\n");

    window.location.href =
      `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const bookForm = document.querySelector("#book-request-form");
  if (bookForm) {
    bookForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(bookForm);
      openEmailRequest("New Book Topic Request", [
        { label: "Full name", value: data.get("name") },
        { label: "Email address", value: data.get("email") },
        { label: "Phone number", value: data.get("phone") },
        { label: "Preferred category", value: data.get("category") },
        { label: "Book topic or idea", value: data.get("idea") }
      ]);
    });
  }

  const photoInput = document.querySelector("#design-photos");
  const photoList = document.querySelector("#photo-list");
  if (photoInput && photoList) {
    photoInput.addEventListener("change", () => {
      const files = Array.from(photoInput.files || []).slice(0, 6);
      if ((photoInput.files || []).length > 6) {
        photoInput.setCustomValidity("Please select no more than 6 photos.");
        photoList.textContent = `Only the first 6 photos can be selected. Please attach ${files.length} photos to the email.`;
      } else if (files.length) {
        photoInput.setCustomValidity("");
        photoList.textContent = `Selected: ${files.map(file => file.name).join(", ")}`;
      } else {
        photoInput.setCustomValidity("");
        photoList.textContent = "";
      }
    });
  }

  const designForm = document.querySelector("#design-request-form");
  if (designForm) {
    designForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(designForm);
      const files = Array.from(photoInput?.files || []).slice(0, 6);
      const photoNames = files.map(file => file.name).join(", ");
      openEmailRequest("Custom Digital Design Request", [
        { label: "Full name", value: data.get("name") },
        { label: "Email address", value: data.get("email") },
        { label: "Phone number", value: data.get("phone") },
        { label: "Request purpose", value: data.get("requestPurpose") },
        { label: "Design type", value: data.get("designType") },
        { label: "Description", value: data.get("description") },
        { label: "Agreement packet completed", value: data.get("agreementPacket") ? "Yes" : "No" },
        { label: "Reference photos", value: photoNames || "No photos selected" }
      ]);
    });
  }

  const partnershipForm = document.querySelector("#partnership-form");
  if (partnershipForm) {
    partnershipForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(partnershipForm);
      openEmailRequest("Affiliate or Business Partnership Request", [
        { label: "Full name", value: data.get("name") },
        { label: "Email address", value: data.get("email") },
        { label: "Phone number", value: data.get("phone") },
        { label: "Business or brand", value: data.get("business") },
        { label: "Website or social media", value: data.get("website") },
        { label: "Partnership type", value: data.get("partnershipType") },
        { label: "Project details", value: data.get("details") },
        { label: "Timeline", value: data.get("timeline") }
      ]);
    });
  }

  const multiJobPhotoInput = document.querySelector("#multi-job-photos");
  const multiJobPhotoList = document.querySelector("#multi-job-photo-list");
  if (multiJobPhotoInput && multiJobPhotoList) {
    multiJobPhotoInput.addEventListener("change", () => {
      const files = Array.from(multiJobPhotoInput.files || []).slice(0, 6);
      if ((multiJobPhotoInput.files || []).length > 6) {
        multiJobPhotoInput.setCustomValidity("Please select no more than 6 photos.");
        multiJobPhotoList.textContent = "Only the first 6 photos can be selected.";
      } else {
        multiJobPhotoInput.setCustomValidity("");
        multiJobPhotoList.textContent = files.length
          ? `Selected: ${files.map(file => file.name).join(", ")}`
          : "";
      }
    });
  }

  const multiJobForm = document.querySelector("#multi-job-form");
  if (multiJobForm) {
    multiJobForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(multiJobForm);
      const photoFiles = Array.from(multiJobPhotoInput?.files || []).slice(0, 6);
      openEmailRequest("Multi-Job Digital Graphic Design Request", [
        { label: "Full name", value: data.get("name") },
        { label: "Email address", value: data.get("email") },
        { label: "Phone number", value: data.get("phone") },
        { label: "Business or brand", value: data.get("business") },
        { label: "Number of designs", value: data.get("designCount") },
        { label: "Package type", value: data.get("packageType") },
        { label: "Design jobs", value: data.get("jobs") },
        { label: "Reference photos", value: photoFiles.map(file => file.name).join(", ") || "No photos selected" },
        { label: "Timeline", value: data.get("timeline") },
        { label: "Agreement packet completed", value: data.get("agreementPacket") ? "Yes" : "No" },
        { label: "Digital copyright terms accepted", value: data.get("copyrightTerms") ? "Yes" : "No" }
      ]);
    });
  }

  const faqContent = document.querySelector("#faq-content");
  const faqSearch = document.querySelector("#faq-search");
  const faqEmpty = document.querySelector("#faq-empty");

  if (faqContent) {
    const faqSections = [
      ["General Business Questions", [
        ["What is Scruffy Butt Digital Designs?", "Scruffy Butt Digital Designs is an independently operated digital bookstore and creative business offering downloadable educational resources, personalized graphic designs, and digital products for individuals and businesses."],
        ["What products and services do you offer?", "We offer digital books, educational guides, personalized artwork, photo collages, promotional graphics, business branding concepts, and additional developing digital and website services."],
        ["Do you provide services for individuals and businesses?", "Yes. We accept personal and commercial design requests. Project requirements, pricing, and ownership rights are established before work begins."],
        ["Where is your business located?", "Scruffy Butt Digital Designs operates primarily online, allowing customers to explore products and submit requests remotely."],
        ["How can I contact Scruffy Butt Digital Designs?", "Visit the Contact Us page or email misshannah@scruffybuttdigitaldesigns.com. Customer service is available Monday through Sunday from 10:00 AM to 10:00 PM."]
      ]],
      ["Digital Bookstore", [
        ["What types of digital books do you sell?", "The bookstore includes personal growth, financial literacy, budgeting, entrepreneurship, relationships, technology, digital literacy, and other self-improvement resources."],
        ["How much do your digital books cost?", "Many books are approximately $29, but individual prices may vary. The final price is shown before purchase."],
        ["How do I receive my digital book?", "Digital products are delivered through the method specified during checkout. Follow the download or access instructions provided with the purchase."],
        ["Can I print a purchased digital book?", "You may print a digital book for personal use when permitted by the product license. Commercial reproduction or redistribution requires additional authorization."],
        ["Can I resell a purchased digital book?", "No, unless the product specifically includes commercial resale rights. Standard purchases generally provide a personal-use license rather than copyright ownership."],
        ["Do you offer refunds on digital books?", "Digital purchases are generally final after successful delivery or access, subject to applicable law and payment-provider requirements. Contact us about defective files, incorrect deliveries, or billing problems."]
      ]],
      ["Book Idea Submissions", [
        ["Can I suggest an idea for a digital book?", "Yes. We welcome book topic suggestions from readers, customers, aspiring writers, and creative individuals."],
        ["How do I submit a book idea?", "Visit the Request page and submit a proposed title, topic, description, and intended audience."],
        ["What happens after I submit an idea?", "We review submissions for relevance, originality, feasibility, and potential reader interest. Selected concepts may lead to further discussion."],
        ["Will I receive recognition if my idea becomes a book?", "Selected contributors may be offered website features, social media recognition, contributor spotlights, or promotional opportunities confirmed in writing."],
        ["Will I receive payment or royalties?", "A submission does not automatically guarantee payment, royalties, or publication. Any compensated collaboration or protected work requires a separate written agreement."],
        ["Will I retain ownership of my book idea?", "General topics and ideas are not necessarily protected by copyright. Copyright generally protects original expression. Any license or transfer of manuscripts or protected work requires an appropriate agreement."]
      ]],
      ["Personalized Graphic Design", [
        ["What personalized designs can I request?", "Available requests include photo collages, digital artwork, social media graphics, business logo concepts, promotional graphics, merchandise artwork, invitations, e-book covers, and website graphics."],
        ["Can I request a design for my business?", "Yes. Identify your intended use in the request so design specifications and rights can be discussed."],
        ["How do I request a personalized design?", "Visit the Request page and complete the custom design form with colors, images, text, preferred style, intended use, and instructions."],
        ["How much do personalized designs cost?", "Pricing depends on project complexity, requested features, revisions, and delivery requirements. A quote is provided before work begins."],
        ["How long does a custom design take?", "Completion time varies by project. An estimated timeline is provided when the request is reviewed and accepted."],
        ["Can I request changes to my design?", "Yes. The number of included revisions is specified in the project agreement. Additional revisions or substantial changes may require another fee."]
      ]],
      ["Copyright & Design Rights", [
        ["Who owns my personalized design after purchase?", "Customers may purchase legally transferable copyright rights in commissioned artwork. Ownership transfers after full payment and execution of a valid written copyright assignment."],
        ["Does Scruffy Butt retain ownership after transfer?", "The applicable rights are relinquished after a valid transfer. Limited portfolio display permission must be separately authorized."],
        ["Can I use my purchased design commercially?", "Yes, to the extent the necessary commercial-use rights are included in the signed agreement."],
        ["Can Scruffy Butt resell my design?", "No. We will not resell or license transferred original artwork to another customer after the applicable rights are transferred."],
        ["Will I receive proof of copyright ownership?", "Customers purchasing transferable copyright rights receive a copy of the executed copyright assignment documenting the transferred rights."],
        ["Can I register my design?", "You may seek copyright or trademark registration when the artwork meets applicable legal requirements. Registration eligibility is not guaranteed."]
      ]],
      ["AI-Assisted Design", [
        ["Does Scruffy Butt use artificial intelligence?", "We may use AI-assisted image generation, digital editing, and other creative technologies for artwork and digital content."],
        ["Will my design be entirely AI-generated?", "The amount of AI assistance varies by project. Customers may ask about the planned creative process before accepting a quote."],
        ["Are AI-generated designs protected by copyright?", "Not necessarily. Eligibility depends on applicable law and the amount of qualifying human authorship. We cannot guarantee exclusive protection for every AI-generated element."],
        ["Is Scruffy Butt responsible for every AI-related legal claim?", "Agreements may limit responsibility for certain claims involving unauthorized customer materials, unlawful modifications, or use outside granted rights. A policy cannot prevent lawsuits or eliminate liability that cannot legally be excluded."]
      ]],
      ["Completed Designs & Privacy", [
        ["Will my personalized design appear in the gallery?", "Only with documented authorization. Customer artwork is not automatically published."],
        ["Why display completed designs?", "Approved examples showcase completed projects, creative styles, and design capabilities."],
        ["Does gallery display transfer ownership?", "No. Gallery authorization grants display permission only and does not transfer copyright ownership back to the business."],
        ["Can I remove artwork from the gallery?", "Yes. Submit a verified removal request. Approved artwork is aimed for removal from business-controlled gallery pages within seven business days."],
        ["Can I keep my design private?", "Yes. Confidential handling is available for sensitive or private artwork through a signed confidentiality agreement."],
        ["What does confidentiality protect?", "The agreement identifies the artwork and restrictions on public display, promotional use, and unauthorized disclosure, subject to stated exceptions."],
        ["Will a private design be shared on social media?", "No. Confidential artwork will not be publicly displayed or promoted without appropriate written authorization."]
      ]],
      ["Payments & Revisions", [
        ["What payment methods are accepted?", "Accepted methods are displayed during checkout or communicated in a custom project quote."],
        ["Do personalized designs require a deposit?", "Some projects require a deposit. Deposit amounts and payment schedules are specified in the project agreement."],
        ["When is final payment due?", "Final payment requirements are established in the agreement. Full payment is generally required before final delivery and copyright transfer."],
        ["Can I cancel a design order?", "Cancellation requests are reviewed according to the project agreement, work completed, and applicable refund policy."],
        ["Are additional revisions free?", "Only revisions included in the agreed project price are free. Extra or substantial revisions may require an additional fee."],
        ["Will I receive payment confirmation?", "Customers should receive transaction confirmation through the applicable payment provider or ordering process."]
      ]],
      ["Partnerships & Support", [
        ["Can content creators collaborate with Scruffy Butt?", "Yes. We welcome creators, entrepreneurs, and businesses interested in promotional or creative partnerships."],
        ["Do you offer affiliate opportunities?", "Affiliate partnerships may be considered individually. Commission arrangements must be confirmed in writing."],
        ["How do I request a partnership?", "Visit the Partnerships or Contact page and provide the partnership type, goals, audience, timeline, and project details."],
        ["Can I donate to support the business?", "Yes. Contributions may be made through the designated PayPal fundraising option on the Contact page."],
        ["What are donations used for?", "Contributions may support website improvements, equipment, software, product development, marketing, operations, and expansion."],
        ["Are donations tax-deductible?", "No. Contributions support a for-profit business and are not represented as charitable or tax-deductible donations."],
        ["Does donating provide ownership or profit-sharing?", "No. Donations do not provide equity, profit-sharing, or guaranteed products or services unless expressly agreed in a separate lawful agreement."]
      ]],
      ["Future Services", [
        ["Will you offer website development?", "Website development is planned for future expansion and availability will be announced as services become operational."],
        ["Will you offer cybersecurity services?", "Professional cybersecurity services are not currently offered. Cybersecurity education and digital protection resources are a future goal."],
        ["Can I request a service that is not listed?", "Yes. Submit a creative or business inquiry through the Request page. All requests are subject to review and acceptance."]
      ]]
    ];

    const renderFaq = filter => {
      const normalized = filter.trim().toLowerCase();
      let visibleSections = 0;
      faqContent.innerHTML = "";

      faqSections.forEach(([title, items]) => {
        const matchingItems = items.filter(([question, answer]) =>
          `${question} ${answer}`.toLowerCase().includes(normalized)
        );
        if (!matchingItems.length) return;
        visibleSections++;

        const section = document.createElement("section");
        section.className = "faq-section";
        section.innerHTML = `<div class="faq-section-heading"><span>${title}</span></div><div class="faq-list"></div>`;
        const list = section.querySelector(".faq-list");

        matchingItems.forEach(([question, answer]) => {
          const item = document.createElement("details");
          item.className = "faq-item";
          item.innerHTML = `<summary>${question}</summary><div class="faq-answer"><p>${answer}</p></div>`;
          list.appendChild(item);
        });

        faqContent.appendChild(section);
      });

      faqEmpty.hidden = visibleSections > 0;
    };

    renderFaq("");
    faqSearch?.addEventListener("input", () => renderFaq(faqSearch.value));
  }

  /* ==========================================
     SCRUFFY BUTT DESIGN CATALOG FILTER
  ========================================== */

  const filterButtons =
    document.querySelectorAll(".filter-btn");

  const productCards =
    document.querySelectorAll(".product-card");


  if (
    filterButtons.length > 0 &&
    productCards.length > 0
  ) {

    filterButtons.forEach(button => {

      button.addEventListener("click", () => {

        const selectedCategory =
          button.dataset.filter || "all";


        /* Update active button */

        filterButtons.forEach(btn => {
          btn.classList.remove("active");
        });

        button.classList.add("active");


        /* Filter design cards */

        productCards.forEach(card => {

          const cardCategory =
            card.dataset.category;


          const shouldShow =
            selectedCategory === "all" ||
            cardCategory === selectedCategory;


          card.style.display =
            shouldShow ? "" : "none";

        });

      });

    });

  }

});
