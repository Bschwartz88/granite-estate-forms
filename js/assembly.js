/**
 * Granite Estate — Statutory Form Assembly Engine (Client-Side & Universal)
 * Assembles official New Hampshire statutory estate planning documents:
 * 1. Simple Will with RSA 551:10 pretermitted heir protections, RSA 551:2 attestation,
 *    and RSA 551:35 self-proving affidavit.
 * 2. Statutory Advance Directive (RSA 137-J:39) combining Health Care POA and Living Will.
 * 3. Statutory Form Power of Attorney for Finances and Property (RSA 564-E:301).
 * 4. Transfer on Death (TOD) Deed (RSA 563-D:19) for NH real estate probate bypass.
 *
 * Universal Module: Works in both browser and Node.js.
 */

function sanitizeFilename_(s) {
  return String(s || 'Client').replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// ---------------------------------------------------------------- Document 1: Simple Will Draft

function assembleSimpleWill_(data) {
  var name = String(data.clientName || 'Testator').trim();
  var town = String(data.town || 'Portsmouth').trim();
  var county = String(data.county || 'Rockingham').trim();
  var spouse = String(data.spouseName || '').trim();
  var children = data.children || [];
  var ex = String(data.executorName || 'Executor').trim();
  var exSucc = String(data.executorSuccessor || 'Successor Executor').trim();
  var guardian = String(data.guardianName || '').trim();

  var cDesc = children.length > 0
    ? children.map(function (c) {
        return (typeof c === 'string' ? c : c.name) + (c.isMinor ? ' (minor)' : ' (adult)');
      }).join(', ')
    : 'no living children, natural or adopted';

  var plan = data.residuePlan || 'spouse_then_children';
  var residueText = '';
  if (plan === 'spouse_then_children' && spouse) {
    residueText = 'I give, devise, and bequeath all the rest, residue, and remainder of my estate, both real and personal, of whatsoever nature and wheresoever situated, to my spouse, ' + spouse + ', provided they survive me by at least thirty (30) days. If my spouse does not survive me by thirty (30) days, I give, devise, and bequeath my residuary estate in equal shares to my surviving children, per stirpes.';
  } else if (plan === 'all_to_children_equal' && children.length > 0) {
    residueText = 'I give, devise, and bequeath all the rest, residue, and remainder of my estate, both real and personal, of whatsoever nature and wheresoever situated, in equal shares to my surviving children, per stirpes.';
  } else if (data.customResidue) {
    residueText = 'I give, devise, and bequeath all the rest, residue, and remainder of my estate as follows: ' + data.customResidue;
  } else {
    residueText = 'I give, devise, and bequeath all the rest, residue, and remainder of my estate to my legal heirs determined in accordance with the laws of descent and distribution of the State of New Hampshire.';
  }

  var lines = [];
  lines.push('LAST WILL AND TESTAMENT OF ' + name.toUpperCase());
  lines.push('');
  lines.push('I, ' + name + ', residing in the City/Town of ' + town + ', County of ' + county + ', State of New Hampshire, being of sound mind and disposing memory and at least eighteen (18) years of age, hereby make, publish, and declare this instrument to be my Last Will and Testament, hereby revoking any and all prior wills and codicils made by me.');
  lines.push('');
  lines.push('ARTICLE I: FAMILY DECLARATION & STATUTORY HEIR PROVISIONS');
  if (spouse) {
    lines.push('I declare that I am married to ' + spouse + ', and all references in this Will to my spouse are to them.');
  } else {
    lines.push('I declare that I am currently unmarried.');
  }
  lines.push('I declare that I have ' + (children.length ? children.length + ' child(ren), namely: ' + cDesc : 'no living children') + '.');
  lines.push('STATUTORY HEIR ACKNOWLEDGMENT (NH RSA 551:10): I have intentionally provided for or omitted my heirs as set forth in this Will. In accordance with New Hampshire RSA 551:10, any child or descendant of mine not specifically granted a bequest or share herein is intentionally omitted and shall not share in my estate as an omitted or pretermitted heir.');
  lines.push('');
  lines.push('ARTICLE II: DISPOSITION OF RESIDUARY ESTATE');
  lines.push(residueText);
  lines.push('');
  lines.push('ARTICLE III: APPOINTMENT OF EXECUTOR (RSA 553)');
  lines.push('I nominate, constitute, and appoint ' + ex + ' as the Executor of this my Last Will and Testament. If ' + ex + ' is unable or unwilling to serve or continue serving as Executor, I nominate, constitute, and appoint ' + exSucc + ' as successor Executor.');
  lines.push('I direct that no Executor nominated herein shall be required to post surety bond or other security in New Hampshire or any other jurisdiction for the faithful performance of their duties (NH RSA 553).');
  lines.push('');

  var hasMinors = children.some(function (c) { return c.isMinor; });
  if (hasMinors && guardian) {
    lines.push('ARTICLE IV: NOMINATION OF GUARDIAN FOR MINOR CHILDREN (RSA 463)');
    lines.push('If at the time of my death any of my children are minors under the age of eighteen (18), and no other parent survives capable of acting as guardian, I nominate and appoint ' + guardian + ' as guardian of the person and estate of my minor child(ren) pursuant to NH RSA 463.');
    lines.push('');
  }

  lines.push('ARTICLE V: EXECUTION & ATTESTATION (RSA 551:2)');
  lines.push('IN WITNESS WHEREOF, I have hereunto signed my name to this Last Will and Testament on this _____ day of ________________, 20____.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push(name + ', Testator');
  lines.push('');
  lines.push('ATTESTATION CLAUSE (NH RSA 551:2)');
  lines.push('The foregoing instrument was on the date thereof signed, published, and declared by the Testator, ' + name + ', to be their Last Will and Testament, in the presence of us, who, at their request, in their presence, and in the presence of each other, have subscribed our names as witnesses thereto, believing the Testator to be of sound mind, memory, and understanding, and at least 18 years of age.');
  lines.push('');
  lines.push('Witness 1 Signature: ____________________________________   Date: _______________');
  lines.push('Printed Name: __________________________________________');
  lines.push('Address: _______________________________________________');
  lines.push('');
  lines.push('Witness 2 Signature: ____________________________________   Date: _______________');
  lines.push('Printed Name: __________________________________________');
  lines.push('Address: _______________________________________________');
  lines.push('');
  lines.push('SELF-PROVING AFFIDAVIT (NH RSA 551:35)');
  lines.push('STATE OF NEW HAMPSHIRE, COUNTY OF ' + county.toUpperCase() + ', SS.');
  lines.push('Before me, the undersigned authority, on this day personally appeared ' + name + ', Testator, and ______________________________ and ______________________________, known to me to be the Testator and the witnesses, whose names are signed to the foregoing instrument, and all of these persons being by me duly sworn, the Testator declared that this instrument is their Last Will and Testament and that they willingly signed it as their free act and deed; and each of the witnesses stated under oath that they signed the Will as witness in the presence and hearing of the Testator and at their request, and that the Testator was at that time of sound mind and memory and 18 years of age or older.');
  lines.push('');
  lines.push('__________________________________________________   Testator');
  lines.push('__________________________________________________   Witness 1');
  lines.push('__________________________________________________   Witness 2');
  lines.push('');
  lines.push('Subscribed and sworn to before me this _____ day of ________________, 20____.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push('Notary Public / Justice of the Peace');
  lines.push('My Commission Expires: ________________________ [Seal]');

  var text = lines.join('\n');
  return {
    filename: 'Will_Draft_' + sanitizeFilename_(name) + '.txt',
    docType: 'will',
    title: 'Last Will and Testament of ' + name,
    content: text
  };
}

// ---------------------------------------------------------------- Document 2: Statutory Advance Directive (RSA 137-J:39)

function assembleAdvanceDirective_(data) {
  var name = String(data.clientName || 'Principal').trim();
  var town = String(data.town || 'Portsmouth').trim();
  var agent = String(data.hcAgentName || 'Health Care Agent').trim();
  var agentPhone = String(data.hcAgentPhone || '(603) 000-0000').trim();
  var altAgent = String(data.hcAgentAlternate || 'Alternate Health Care Agent').trim();
  var altAgentPhone = String(data.hcAgentAlternatePhone || '(603) 000-0000').trim();

  var lines = [];
  lines.push('NEW HAMPSHIRE STATUTORY ADVANCE DIRECTIVE');
  lines.push('(Pursuant to New Hampshire RSA 137-J:39)');
  lines.push('');
  lines.push('STATUTORY DISCLOSURE NOTICE (RSA 137-J:13 / RSA 137-J:39)');
  lines.push('NOTICE TO PERSON MAKING AN ADVANCE DIRECTIVE: This is an important legal document. Before signing this document, you should know these important facts: This document gives the person you designate as your agent the power to make health care decisions for you, subject to any limitations you include in this document. You have the right to revoke this document at any time you have capacity. If you sign this document, your health care providers are required to follow the instructions of your agent or the instructions contained in your living will if you are unable to make health care decisions for yourself.');
  lines.push('');
  lines.push('PART I: DURABLE POWER OF ATTORNEY FOR HEALTH CARE');
  lines.push('I, ' + name + ', residing in ' + town + ', New Hampshire, hereby appoint:\nPrimary Health Care Agent: ' + agent + '\nPhone: ' + agentPhone + '\nas my health care agent to make health care decisions for me if I am not capable of making my own health care decisions.');
  lines.push('');
  lines.push('If the agent named above is not available, unable, or unwilling to act, I appoint:\nAlternate Health Care Agent: ' + altAgent + '\nPhone: ' + altAgentPhone + '\nas my alternate health care agent with the same powers and duties.');
  lines.push('');
  lines.push('GENERAL POWERS OF AGENT: My health care agent has full power and authority to make health care decisions on my behalf, including consent, refusal of consent, or withdrawal of consent to any medical care, treatment, service, or procedure; access to my medical records pursuant to the Health Insurance Portability and Accountability Act (HIPAA, 42 U.S.C. § 1320d); and decisions concerning life-sustaining treatment and artificial nutrition and hydration in accordance with my wishes expressed herein.');
  lines.push('');
  lines.push('PART II: LIVING WILL (LIFE-SUSTAINING TREATMENT)');
  lines.push('If I should have an incurable and irreversible condition that has been medically certified to be a terminal condition, or if I am medically certified to be in a persistent vegetative state / permanent unconsciousness, and I am unable to make decisions for myself:');
  lines.push('');
  lines.push('1. I direct that life-sustaining treatment be withheld or withdrawn, and that I be permitted to die naturally with only the administration of medication or the performance of any medical procedure deemed necessary to provide me with comfort care and alleviate pain.');
  lines.push('');
  lines.push('2. Medically Administered Nutrition and Hydration: [Initial one choice below]');
  lines.push('   [ _____ ] I DO NOT want medically administered nutrition and hydration if it would only prolong my dying process.');
  lines.push('   [ _____ ] I DO want medically administered nutrition and hydration regardless of my prognosis.');
  lines.push('');
  lines.push('PART III: EXECUTION AND ACKNOWLEDGMENT');
  lines.push('Signed this _____ day of ________________, 20____.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push(name + ', Principal');
  lines.push('');
  lines.push('STATEMENT OF TWO WITNESSES (NH RSA 137-J:14)');
  lines.push('I declare under penalty of perjury that the principal signed or acknowledged this advance directive in my presence, that the principal appears to be of sound mind and under no duress, fraud, or undue influence, and that I am not the designated health care agent, not a health care provider attending the principal, and not entitled to any portion of the principal\'s estate under will or operation of law.');
  lines.push('');
  lines.push('Witness 1: ____________________________________   Date: _______________');
  lines.push('Printed Name & Address: ________________________________________________');
  lines.push('');
  lines.push('Witness 2: ____________________________________   Date: _______________');
  lines.push('Printed Name & Address: ________________________________________________');
  lines.push('');
  lines.push('NOTARY ACKNOWLEDGMENT (ALTERNATIVE UNDER NH RSA 137-J:15)');
  lines.push('STATE OF NEW HAMPSHIRE, COUNTY OF ____________________, SS.');
  lines.push('On this _____ day of _______________, 20____, before me personally appeared ' + name + ', known to me to be the person who executed the foregoing Advance Directive, and acknowledged the same to be their free act and deed.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push('Notary Public / Justice of the Peace');
  lines.push('My Commission Expires: ________________________ [Seal]');

  var text = lines.join('\n');
  return {
    filename: 'Advance_Directive_RSA137J_' + sanitizeFilename_(name) + '.txt',
    docType: 'advance_directive',
    title: 'NH Statutory Advance Directive of ' + name,
    content: text
  };
}

// ---------------------------------------------------------------- Document 3: Statutory Financial POA (RSA 564-E:301)

function assembleFinancialPOA_(data) {
  var name = String(data.clientName || 'Principal').trim();
  var town = String(data.town || 'Portsmouth').trim();
  var county = String(data.county || 'Rockingham').trim();
  var agent = String(data.finAgentName || 'Financial Agent').trim();
  var agentPhone = String(data.finAgentPhone || '(603) 000-0000').trim();
  var altAgent = String(data.finAgentAlternate || 'Successor Financial Agent').trim();
  var altAgentPhone = String(data.finAgentAlternatePhone || '(603) 000-0000').trim();

  var lines = [];
  lines.push('NEW HAMPSHIRE STATUTORY FORM POWER OF ATTORNEY FOR FINANCES AND PROPERTY');
  lines.push('(Pursuant to New Hampshire RSA 564-E:301 — Uniform Power of Attorney Act)');
  lines.push('');
  lines.push('IMPORTANT INFORMATION FOR PRINCIPAL');
  lines.push('This power of attorney authorizes another person (your agent) to make decisions concerning your property for you (the principal). Your agent will be able to make decisions and act with respect to your property (including your money) whether or not you are able to act for yourself. The meaning of authority over subjects listed on this form is explained in the Uniform Power of Attorney Act, RSA 564-E. This power of attorney does not authorize the agent to make health-care decisions for you. You should select someone you trust to serve as your agent. Unless you specify otherwise, generally the agent’s authority will continue until you die or revoke the power of attorney.');
  lines.push('');
  lines.push('1. DESIGNATION OF AGENT');
  lines.push('I, ' + name + ', residing in ' + town + ', County of ' + county + ', State of New Hampshire, name the following person as my agent:\nPrimary Agent: ' + agent + '\nPhone: ' + agentPhone);
  lines.push('');
  lines.push('2. DESIGNATION OF SUCCESSOR AGENT (RSA 564-E:111)');
  lines.push('If my agent is unable or unwilling to act for me, I name as my successor agent:\nSuccessor Agent: ' + altAgent + '\nPhone: ' + altAgentPhone);
  lines.push('');
  lines.push('3. GRANT OF GENERAL AUTHORITY (RSA 564-E:204 THROUGH 564-E:216)');
  lines.push('I grant my agent and any successor agent general authority to act for me with respect to the following subjects as defined in RSA 564-E:\n\n[X] Real Property (RSA 564-E:204)\n[X] Tangible Personal Property (RSA 564-E:205)\n[X] Stocks and Bonds (RSA 564-E:206)\n[X] Commodities and Options (RSA 564-E:207)\n[X] Banks and Other Financial Institutions (RSA 564-E:208)\n[X] Operation of Entity or Business (RSA 564-E:209)\n[X] Insurance and Annuities (RSA 564-E:210)\n[X] Estates, Trusts, and Other Beneficial Interests (RSA 564-E:211)\n[X] Claims and Litigation (RSA 564-E:212)\n[X] Personal and Family Maintenance (RSA 564-E:213)\n[X] Benefits from Governmental Programs or Civil or Military Service (RSA 564-E:214)\n[X] Retirement Plans (RSA 564-E:215)\n[X] Taxes (RSA 564-E:216)');
  lines.push('');
  lines.push('4. GRANT OF SPECIFIC AUTHORITY (“HOT POWERS” - RSA 564-E:201)');
  lines.push('CAUTION: Granting any of the following will give your agent the authority to take actions that could significantly reduce your property or change how your property is distributed at your death. INITIAL ONLY the specific authority you WANT to give your agent:\n\n[ _____ ] Create, fund, or amend an inter vivos trust\n[ _____ ] Make a gift (subject to RSA 564-E:217 limits)\n[ _____ ] Create or change rights of survivorship\n[ _____ ] Create or change a beneficiary designation\n[ _____ ] Authorize another person to exercise authority granted under this power of attorney\n[ _____ ] Waive the principal\'s right to be a beneficiary of a joint and survivor annuity');
  lines.push('');
  lines.push('5. DURABILITY (RSA 564-E:104)');
  lines.push('This power of attorney is durable and remains effective notwithstanding the subsequent disability or incapacity of the principal.');
  lines.push('');
  lines.push('6. SIGNATURE AND NOTARY ACKNOWLEDGMENT (RSA 564-E:105)');
  lines.push('Signed this _____ day of ________________, 20____.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push(name + ', Principal');
  lines.push('');
  lines.push('STATE OF NEW HAMPSHIRE, COUNTY OF ' + county.toUpperCase() + ', SS.');
  lines.push('This document was acknowledged before me on this _____ day of ________________, 20____, by ' + name + ', Principal.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push('Notary Public / Justice of the Peace');
  lines.push('My Commission Expires: ________________________ [Seal]');

  var text = lines.join('\n');
  return {
    filename: 'Financial_POA_RSA564E_' + sanitizeFilename_(name) + '.txt',
    docType: 'financial_poa',
    title: 'NH Statutory Financial Power of Attorney of ' + name,
    content: text
  };
}

// ---------------------------------------------------------------- Document 4: Transfer on Death Deed (RSA 563-D:19)

function assembleTODDeed_(data) {
  var name = String(data.clientName || 'Owner').trim();
  var county = String(data.county || 'Rockingham').trim();
  var address = String(data.realEstateAddress || '100 Main Street, Portsmouth, NH').trim();
  var beneficiary = String(data.todBeneficiary || data.spouseName || 'Named Beneficiary').trim();

  var lines = [];
  lines.push('NEW HAMPSHIRE STATUTORY TRANSFER ON DEATH DEED');
  lines.push('(Pursuant to New Hampshire RSA 563-D:19 — Uniform Real Property Transfer on Death Act)');
  lines.push('');
  lines.push('MANDATORY STATUTORY NOTICE (NH RSA 563-D:9)');
  lines.push('NOTICE TO OWNER: This deed must be recorded before your death, or it will not be effective. In New Hampshire, this deed must be recorded in the county Registry of Deeds within 60 days of the date it is executed (RSA 563-D:9). This deed is revocable by you at any time prior to your death by recording a revocation instrument or a subsequent transfer on death deed.');
  lines.push('');
  lines.push('1. TRANSFEROR (OWNER)');
  lines.push('I, ' + name + ', having a mailing address at ' + address + ', declare that I am the sole or joint owner of the real property described below.');
  lines.push('');
  lines.push('2. PROPERTY DESCRIPTION');
  lines.push('The real property located at: ' + address + ', situated in the County of ' + county + ', State of New Hampshire, more particularly described in the deed recorded in the ' + county + ' County Registry of Deeds at Book ________, Page ________.');
  lines.push('');
  lines.push('3. DESIGNATED BENEFICIARY');
  lines.push('I designate the following beneficiary to receive ownership of the described real property upon my death:\n' + beneficiary);
  lines.push('');
  lines.push('4. TRANSFER ON DEATH DECLARATION');
  lines.push('Pursuant to NH RSA 563-D, I hereby transfer all of my right, title, and interest in the described real property to the designated beneficiary effective upon my death. Prior to my death, I retain full ownership of the property, including the right to sell, mortgage, convey, or revoke this deed.');
  lines.push('');
  lines.push('5. SIGNATURE & NOTARY ACKNOWLEDGMENT');
  lines.push('Executed this _____ day of ________________, 20____.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push(name + ', Transferor / Owner');
  lines.push('');
  lines.push('STATE OF NEW HAMPSHIRE, COUNTY OF ' + county.toUpperCase() + ', SS.');
  lines.push('On this _____ day of ________________, 20____, before me personally appeared ' + name + ', known to me to be the person described herein, and acknowledged that they executed the foregoing Transfer on Death Deed as their free act and deed.');
  lines.push('');
  lines.push('__________________________________________________');
  lines.push('Notary Public / Justice of the Peace');
  lines.push('My Commission Expires: ________________________ [Seal]');

  var text = lines.join('\n');
  return {
    filename: 'TOD_Deed_RSA563D_' + sanitizeFilename_(name) + '.txt',
    docType: 'deed',
    title: 'NH Transfer on Death Deed for ' + address,
    content: text
  };
}

function assembleAllDocuments(data) {
  var docs = [];
  docs.push(assembleSimpleWill_(data));
  docs.push(assembleAdvanceDirective_(data));
  docs.push(assembleFinancialPOA_(data));
  if (data.hasRealEstate && data.includeTODDeed) {
    docs.push(assembleTODDeed_(data));
  }
  return docs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    assembleSimpleWill_: assembleSimpleWill_,
    assembleAdvanceDirective_: assembleAdvanceDirective_,
    assembleFinancialPOA_: assembleFinancialPOA_,
    assembleTODDeed_: assembleTODDeed_,
    assembleAllDocuments: assembleAllDocuments
  };
}
