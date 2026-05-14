"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { SkillTag } from "@/components/ui/SkillTag";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPin, Building2, Clock, Sparkles, FileText, GitCompareArrows, ClipboardList, ArrowLeft, Trash2, Pencil, Plus, UserRound, Mail, Link as LinkIcon, MessageSquare, Copy, Send, CheckCircle, XCircle } from "lucide-react";
import {
  getJob,
  updateJob,
  listResumes,
  createMatch,
  explainMatch,
  generateCoverLetter,
  createApplication,
  deleteJob,
  listOutreachContactsForJob,
  createOutreachContact,
  updateOutreachContact,
  deleteOutreachContact,
  listOutreachMessagesForJob,
  generateOutreachMessage,
  updateOutreachMessage,
  deleteOutreachMessage,
} from "@/lib/api";
import type {
  Job,
  Resume,
  MatchResult,
  AIExplanation,
  OutreachContact,
  CreateOutreachContactPayload,
  UpdateOutreachContactPayload,
  OutreachMessage,
  OutreachMessageType,
  OutreachMessageStatus,
  GeneratedOutreachMessageResponse,
} from "@/types/api";
import Link from "next/link";

type EditableJob = Job & { raw_text?: string };
type ContactForm = {
  name: string;
  title: string;
  company: string;
  email: string;
  linkedin_url: string;
  source: string;
  confidence_score: string;
  notes: string;
};

const emptyContactForm: ContactForm = {
  name: "",
  title: "",
  company: "",
  email: "",
  linkedin_url: "",
  source: "",
  confidence_score: "",
  notes: "",
};

const MESSAGE_TYPE_LABELS: Record<OutreachMessageType, string> = {
  email: "Email",
  linkedin_dm: "LinkedIn DM",
  follow_up: "Follow-up",
  referral_request: "Referral Ask",
};

const STATUS_LABELS: Record<OutreachMessageStatus, string> = {
  draft: "Draft",
  copied: "Copied",
  sent: "Sent",
  replied: "Replied",
  closed: "Closed",
};

const statusClass = (status: OutreachMessageStatus) => {
  const classes: Record<OutreachMessageStatus, string> = {
    draft: "border-white/10 bg-white/5 text-muted",
    copied: "border-accent-cyan/25 bg-accent-cyan/10 text-accent-cyan",
    sent: "border-success/25 bg-success/10 text-success",
    replied: "border-success/25 bg-success/10 text-success",
    closed: "border-white/10 bg-white/[0.03] text-muted-dark",
  };
  return classes[status];
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Match state
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matching, setMatching] = useState(false);

  // AI states
  const [apiKeyModal, setApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [aiAction, setAiAction] = useState<"explain" | "cover" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [coverLetterMessage, setCoverLetterMessage] = useState("");
  const [aiError, setAiError] = useState("");

  // Application
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);

  // Outreach contacts
  const [outreachContacts, setOutreachContacts] = useState<OutreachContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<OutreachContact | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactDeletingId, setContactDeletingId] = useState<number | null>(null);
  const [contactError, setContactError] = useState("");
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);

  // Outreach messages
  const [outreachMessages, setOutreachMessages] = useState<OutreachMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState("");
  const [messageUpdatingId, setMessageUpdatingId] = useState<number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<number[]>([]);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [generationContact, setGenerationContact] = useState<OutreachContact | null>(null);
  const [generationType, setGenerationType] = useState<OutreachMessageType>("email");
  const [generationApiKey, setGenerationApiKey] = useState("");
  const [generationExtraContext, setGenerationExtraContext] = useState("");
  const [generationSaveAsDraft, setGenerationSaveAsDraft] = useState(true);
  const [generationResumeId, setGenerationResumeId] = useState<number | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationCopySuccess, setGenerationCopySuccess] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState<GeneratedOutreachMessageResponse | null>(null);

  // Edit job
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    company: "",
    location: "",
    employment_type: "",
    source_label: "",
    raw_text: "",
  });

  const loadOutreachContacts = useCallback(async (jobId: number) => {
    setContactsLoading(true);
    setContactError("");
    try {
      const result = await listOutreachContactsForJob(jobId);
      setOutreachContacts(result.contacts);
    } catch (e: unknown) {
      setContactError(e instanceof Error ? e.message : "Failed to load outreach contacts.");
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadOutreachMessages = useCallback(async (jobId: number) => {
    setMessagesLoading(true);
    setMessageError("");
    try {
      const result = await listOutreachMessagesForJob(jobId);
      setOutreachMessages(result.messages);
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : "Failed to load outreach messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const jobId = Number(id);
    Promise.all([getJob(jobId), listResumes()])
      .then(([j, r]) => {
        setJob(j);
        setResumes(r.resumes);
        if (r.resumes.length > 0) setSelectedResumeId(r.resumes[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadOutreachContacts(jobId);
    loadOutreachMessages(jobId);
  }, [id, loadOutreachContacts, loadOutreachMessages]);

  const handleMatch = async () => {
    if (!selectedResumeId) return;
    setMatching(true);
    try {
      const m = await createMatch(Number(id), selectedResumeId);
      setMatchResult(m);
    } catch { /* ignore */ }
    finally { setMatching(false); }
  };

  const openAiAction = (action: "explain" | "cover") => {
    setAiAction(action);
    setAiError("");
    setCoverLetterMessage("");
    setApiKeyModal(true);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const runAiAction = async () => {
    if (!apiKey.trim() || !selectedResumeId) return;
    setAiLoading(true); setAiError("");
    try {
      if (aiAction === "explain") {
        const r = await explainMatch(Number(id), selectedResumeId, apiKey);
        setExplanation(r.explanation);
      } else {
        const pdfBlob = await generateCoverLetter(Number(id), selectedResumeId, apiKey);
        downloadBlob(pdfBlob, "cover_letter.pdf");
        setCoverLetterMessage("Cover letter downloaded successfully.");
      }
      setApiKeyModal(false);
    } catch (e: unknown) { setAiError(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiLoading(false); }
  };

  const handleTrack = async () => {
    if (!selectedResumeId) return;
    setTracking(true);
    try {
      await createApplication({ job_id: Number(id), resume_id: selectedResumeId, status: "saved" });
      setTracked(true);
    } catch { /* ignore */ }
    finally { setTracking(false); }
  };

  const handleDeleteJob = async () => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteJob(Number(id));
      router.push("/jobs");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to delete job.");
    }
  };

  const openAddContactModal = () => {
    setEditingContact(null);
    setContactForm(emptyContactForm);
    setContactError("");
    setContactModalOpen(true);
  };

  const openEditContactModal = (contact: OutreachContact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name ?? "",
      title: contact.title ?? "",
      company: contact.company ?? "",
      email: contact.email ?? "",
      linkedin_url: contact.linkedin_url ?? "",
      source: contact.source ?? "",
      confidence_score: contact.confidence_score === null ? "" : String(contact.confidence_score),
      notes: contact.notes ?? "",
    });
    setContactError("");
    setContactModalOpen(true);
  };

  const contactValue = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const buildContactPayload = (): Omit<CreateOutreachContactPayload, "job_id"> | null => {
    const name = contactForm.name.trim();
    if (!name) {
      setContactError("Name is required.");
      return null;
    }

    const confidenceText = contactForm.confidence_score.trim();
    let confidence_score: number | null = null;
    if (confidenceText) {
      confidence_score = Number(confidenceText);
      if (Number.isNaN(confidence_score)) {
        setContactError("Confidence score must be a number.");
        return null;
      }
    }

    return {
      name,
      title: contactValue(contactForm.title),
      company: contactValue(contactForm.company),
      email: contactValue(contactForm.email),
      linkedin_url: contactValue(contactForm.linkedin_url),
      source: contactValue(contactForm.source),
      confidence_score,
      notes: contactValue(contactForm.notes),
    };
  };

  const handleSaveContact = async () => {
    const payload = buildContactPayload();
    if (!payload) return;

    setContactSaving(true);
    setContactError("");
    try {
      if (editingContact) {
        const updated = await updateOutreachContact(editingContact.id, payload as UpdateOutreachContactPayload);
        setOutreachContacts((contacts) => contacts.map((contact) => contact.id === updated.id ? updated : contact));
      } else {
        const created = await createOutreachContact({ job_id: Number(id), ...payload });
        setOutreachContacts((contacts) => [created, ...contacts]);
      }
      setContactModalOpen(false);
      setEditingContact(null);
      setContactForm(emptyContactForm);
    } catch (e: unknown) {
      setContactError(e instanceof Error ? e.message : "Failed to save contact.");
    } finally {
      setContactSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!window.confirm("Delete this outreach contact?")) return;
    setContactDeletingId(contactId);
    setContactError("");
    try {
      await deleteOutreachContact(contactId);
      setOutreachContacts((contacts) => contacts.filter((contact) => contact.id !== contactId));
      loadOutreachMessages(Number(id));
    } catch (e: unknown) {
      setContactError(e instanceof Error ? e.message : "Failed to delete contact.");
    } finally {
      setContactDeletingId(null);
    }
  };

  const openGenerationModal = (contact: OutreachContact, type: OutreachMessageType) => {
    setGenerationContact(contact);
    setGenerationType(type);
    setGenerationResumeId(selectedResumeId);
    setGenerationExtraContext("");
    setGenerationSaveAsDraft(true);
    setGenerationError("");
    setGenerationCopySuccess("");
    setGeneratedMessage(null);
    setGenerationModalOpen(true);
  };

  const selectedGenerationResume = resumes.find((resume) => resume.id === generationResumeId);
  const generationMatchId = matchResult && generationResumeId === matchResult.resume_id ? matchResult.id : null;

  const copyTextForMessage = (message: { subject: string | null; body: string; message_type: string }) => {
    if (message.message_type === "email" && message.subject) {
      return `Subject: ${message.subject}\n\n${message.body}`;
    }
    return message.body;
  };

  const updateMessageInState = (updated: OutreachMessage) => {
    setOutreachMessages((messages) => messages.map((message) => message.id === updated.id ? updated : message));
  };

  const copySavedMessage = async (message: OutreachMessage) => {
    setMessageError("");
    try {
      await navigator.clipboard.writeText(copyTextForMessage(message));
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 2500);
      if (message.status === "draft") {
        setMessageUpdatingId(message.id);
        const updated = await updateOutreachMessage(message.id, { status: "copied" });
        updateMessageInState(updated);
      }
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : "Failed to copy message.");
    } finally {
      setMessageUpdatingId(null);
    }
  };

  const copyGeneratedMessage = async () => {
    if (!generatedMessage) return;
    setGenerationError("");
    setGenerationCopySuccess("");
    try {
      await navigator.clipboard.writeText(copyTextForMessage(generatedMessage));
      setGenerationCopySuccess("Copied to clipboard.");
      window.setTimeout(() => setGenerationCopySuccess(""), 2500);
      if (generatedMessage.message_id) {
        const saved = outreachMessages.find((message) => message.id === generatedMessage.message_id);
        if (!saved || saved.status === "draft") {
          const updated = await updateOutreachMessage(generatedMessage.message_id, { status: "copied" });
          updateMessageInState(updated);
        }
      }
    } catch (e: unknown) {
      setGenerationError(e instanceof Error ? e.message : "Failed to copy message.");
    }
  };

  const updateMessageStatus = async (message: OutreachMessage, status: OutreachMessageStatus) => {
    setMessageUpdatingId(message.id);
    setMessageError("");
    try {
      const updated = await updateOutreachMessage(message.id, {
        status,
        ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      });
      updateMessageInState(updated);
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : "Failed to update message.");
    } finally {
      setMessageUpdatingId(null);
    }
  };

  const toggleExpandedMessage = (messageId: number) => {
    setExpandedMessageIds((ids) => (
      ids.includes(messageId) ? ids.filter((id) => id !== messageId) : [...ids, messageId]
    ));
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!window.confirm("Delete this outreach message?")) return;
    setMessageUpdatingId(messageId);
    setMessageError("");
    try {
      await deleteOutreachMessage(messageId);
      setOutreachMessages((messages) => messages.filter((message) => message.id !== messageId));
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : "Failed to delete message.");
    } finally {
      setMessageUpdatingId(null);
    }
  };

  const runOutreachGeneration = async () => {
    if (!generationApiKey.trim()) {
      setGenerationError("OpenAI API key is required.");
      return;
    }

    setGenerationLoading(true);
    setGenerationError("");
    setGeneratedMessage(null);
    try {
      const result = await generateOutreachMessage({
        job_id: Number(id),
        contact_id: generationContact?.id ?? null,
        resume_id: generationResumeId ?? null,
        match_id: generationMatchId,
        message_type: generationType,
        api_key: generationApiKey,
        save_as_draft: generationSaveAsDraft,
        extra_context: generationExtraContext.trim() || null,
      });
      setGeneratedMessage(result);
      if (generationSaveAsDraft) {
        await loadOutreachMessages(Number(id));
      }
    } catch (e: unknown) {
      setGenerationError(e instanceof Error ? e.message : "Failed to generate outreach draft.");
    } finally {
      setGenerationLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-32 text-muted">Loading…</div>;
  const openEditModal = () => {
    if (!job) return;
    setEditError("");
    setEditForm({
      title: job.title ?? "",
      company: job.company ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "",
      source_label: job.source_label ?? "",
      raw_text: (job as EditableJob).raw_text ?? "",
    });
    setEditModalOpen(true);
  };

  const handleUpdateJob = async () => {
    if (!job) return;
    setEditSaving(true);
    setEditError("");
    try {
      const updatedJob = await updateJob(job.id, editForm);
      setJob(updatedJob);
      setEditModalOpen(false);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update job.");
    } finally {
      setEditSaving(false);
    }
  };

  if (!job) return <EmptyState title="Job not found" />;

  const profile = job.parsed_profile;

  return (
    <>
      <Topbar title={job.title || "Job Details"} subtitle={`${job.company}${job.location ? ` · ${job.location}` : ""}`} />

      <Link href="/jobs" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={12} /> Back to Jobs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left — Job details */}
        <div className="lg:col-span-2 hyrra-section-stack">
          {/* Meta */}
          <Card>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
              {job.company && <span className="flex items-center gap-1.5 text-xs text-muted"><Building2 size={13} /> {job.company}</span>}
              {job.location && <span className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} /> {job.location}</span>}
              {job.employment_type && <span className="flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> {job.employment_type}</span>}
            </div>

            {profile?.required_skills && profile.required_skills.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs text-muted mb-2 font-medium">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">{profile.required_skills.map((s) => <SkillTag key={s} skill={s} variant="neutral" />)}</div>
              </div>
            )}
            {profile?.preferred_skills && profile.preferred_skills.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs text-muted mb-2 font-medium">Preferred Skills</h4>
                <div className="flex flex-wrap gap-1.5">{profile.preferred_skills.map((s) => <SkillTag key={s} skill={s} variant="neutral" />)}</div>
              </div>
            )}
          </Card>

          {profile?.responsibilities && profile.responsibilities.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold mb-3">Responsibilities</h4>
              <ul className="space-y-1.5 text-sm text-muted">{profile.responsibilities.map((r, i) => <li key={i} className="flex gap-2"><span className="text-accent-violet mt-1">•</span>{r}</li>)}</ul>
            </Card>
          )}
          {profile?.qualifications && profile.qualifications.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold mb-3">Qualifications</h4>
              <ul className="space-y-1.5 text-sm text-muted">{profile.qualifications.map((q, i) => <li key={i} className="flex gap-2"><span className="text-accent-cyan mt-1">•</span>{q}</li>)}</ul>
            </Card>
          )}

          {/* Outreach */}
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UserRound size={14} className="text-accent-cyan" /> Outreach Contacts
                </h4>
                <p className="text-xs text-muted mt-1">Track recruiters, hiring managers, founders, or referral contacts for this job. Hyrra helps you draft messages, but you stay in control of sending.</p>
              </div>
              <GradientButton size="sm" variant="secondary" onClick={openAddContactModal}>
                <Plus size={13} /> Add Contact
              </GradientButton>
            </div>
            <p className="text-[10px] text-muted-dark mb-4">Hyrra creates drafts and tracking only. Review messages before sending and avoid bulk or spammy outreach.</p>

            {contactError && !contactModalOpen && (
              <p className="text-xs text-danger mb-3">{contactError}</p>
            )}

            {contactsLoading ? (
              <div className="py-8 text-center text-sm text-muted">Loading contacts...</div>
            ) : outreachContacts.length === 0 ? (
              <EmptyState
                title="No outreach contacts yet"
                description="Add a recruiter, hiring manager, founder, or referral contact to generate targeted outreach drafts."
                icon={<UserRound size={42} strokeWidth={1} />}
              />
            ) : (
              <div className="space-y-3">
                {outreachContacts.map((contact) => {
                  const linkedMessageCount = outreachMessages.filter((message) => message.contact_id === contact.id).length;
                  return (
                  <div key={contact.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h5 className="text-sm font-semibold text-foreground break-words">{contact.name}</h5>
                          {contact.confidence_score !== null && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted">
                              Confidence {contact.confidence_score}
                            </span>
                          )}
                          {linkedMessageCount > 0 && (
                            <span className="rounded-full border border-accent-violet/20 bg-accent-violet/10 px-2 py-0.5 text-[10px] text-accent-violet">
                              {linkedMessageCount} {linkedMessageCount === 1 ? "message" : "messages"}
                            </span>
                          )}
                        </div>
                        {(contact.title || contact.company) && (
                          <p className="text-xs text-muted mt-1 break-words">
                            {[contact.title, contact.company].filter(Boolean).join(" at ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditContactModal(contact)}
                          className="hyrra-icon-action cursor-pointer"
                          title="Edit contact"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(contact.id)}
                          disabled={contactDeletingId === contact.id}
                          className="hyrra-icon-action hover:text-danger hover:bg-danger/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete contact"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                      {contact.email && (
                        <span className="flex min-w-0 items-center gap-1.5 break-all">
                          <Mail size={12} className="shrink-0" /> {contact.email}
                        </span>
                      )}
                      {contact.linkedin_url && (
                        <span className="flex min-w-0 items-center gap-1.5 break-all">
                          <LinkIcon size={12} className="shrink-0" /> {contact.linkedin_url}
                        </span>
                      )}
                      {contact.source && (
                        <span className="flex min-w-0 items-center gap-1.5 break-words">
                          <LinkIcon size={12} className="shrink-0" /> Source: {contact.source}
                        </span>
                      )}
                    </div>

                    {contact.notes && (
                      <p className="mt-3 border-t border-white/5 pt-3 text-xs text-muted leading-relaxed break-words">{contact.notes}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      <GradientButton size="sm" variant="secondary" onClick={() => openGenerationModal(contact, "email")}>
                        <Mail size={12} /> Generate Email
                      </GradientButton>
                      <GradientButton size="sm" variant="secondary" onClick={() => openGenerationModal(contact, "linkedin_dm")}>
                        <LinkIcon size={12} /> LinkedIn DM
                      </GradientButton>
                      <GradientButton size="sm" variant="secondary" onClick={() => openGenerationModal(contact, "follow_up")}>
                        <MessageSquare size={12} /> Follow-up
                      </GradientButton>
                      <GradientButton size="sm" variant="secondary" onClick={() => openGenerationModal(contact, "referral_request")}>
                        <UserRound size={12} /> Referral Ask
                      </GradientButton>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Outreach Messages */}
          <Card>
            <div className="mb-5">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare size={14} className="text-accent-violet" /> Outreach Messages
              </h4>
              <p className="text-xs text-muted mt-1">Generated drafts and outreach tracking for this job. Hyrra does not send these messages.</p>
            </div>

            {messageError && <p className="text-xs text-danger mb-3">{messageError}</p>}

            {messagesLoading ? (
              <div className="py-8 text-center text-sm text-muted">Loading messages...</div>
            ) : outreachMessages.length === 0 ? (
              <EmptyState
                title="No outreach messages yet"
                description="Generate a draft from a contact to start tracking outreach for this job."
                icon={<MessageSquare size={42} strokeWidth={1} />}
              />
            ) : (
              <div className="space-y-3">
                {outreachMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">
                            {MESSAGE_TYPE_LABELS[message.message_type]}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(message.status)}`}>
                            {STATUS_LABELS[message.status]}
                          </span>
                          <span className="text-xs text-muted">{message.contact_name ? `To ${message.contact_name}` : "No contact linked"}</span>
                        </div>
                        {message.subject && <h5 className="mt-3 text-sm font-semibold text-foreground break-words">{message.subject}</h5>}
                        <p className="mt-2 text-xs text-muted leading-relaxed whitespace-pre-wrap break-words">
                          {message.body.length > 360 && !expandedMessageIds.includes(message.id) ? `${message.body.slice(0, 360)}...` : message.body}
                        </p>
                        {message.body.length > 360 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedMessage(message.id)}
                            className="mt-2 text-xs font-medium text-accent-cyan hover:underline cursor-pointer"
                          >
                            {expandedMessageIds.includes(message.id) ? "Show less" : "View full message"}
                          </button>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-dark">
                          {message.created_at && <span>Created {new Date(message.created_at).toLocaleDateString()}</span>}
                          {message.sent_at && <span>Sent {new Date(message.sent_at).toLocaleDateString()}</span>}
                          {message.follow_up_date && <span>Follow up {new Date(message.follow_up_date).toLocaleDateString()}</span>}
                        </div>
                        {copiedMessageId === message.id && <p className="mt-2 text-xs text-success">Copied to clipboard.</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      <GradientButton size="sm" variant="secondary" onClick={() => copySavedMessage(message)} disabled={messageUpdatingId === message.id}>
                        <Copy size={12} /> Copy Message
                      </GradientButton>
                      {!["sent", "replied", "closed"].includes(message.status) && (
                        <GradientButton size="sm" variant="secondary" onClick={() => updateMessageStatus(message, "sent")} disabled={messageUpdatingId === message.id}>
                          <Send size={12} /> Mark Sent
                        </GradientButton>
                      )}
                      {!["replied", "closed"].includes(message.status) && (
                        <GradientButton size="sm" variant="secondary" onClick={() => updateMessageStatus(message, "replied")} disabled={messageUpdatingId === message.id}>
                          <CheckCircle size={12} /> Mark Replied
                        </GradientButton>
                      )}
                      {message.status !== "closed" && (
                        <GradientButton size="sm" variant="secondary" onClick={() => updateMessageStatus(message, "closed")} disabled={messageUpdatingId === message.id}>
                          <XCircle size={12} /> Mark Closed
                        </GradientButton>
                      )}
                      <GradientButton size="sm" variant="ghost" className="text-danger hover:text-danger hover:bg-danger/10" onClick={() => handleDeleteMessage(message.id)} disabled={messageUpdatingId === message.id}>
                        <Trash2 size={12} /> Delete
                      </GradientButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Match result */}
          {matchResult && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-sm font-semibold">Match Result</h4>
                <MatchScoreBadge score={matchResult.match_score} />
                <span className="text-xs text-muted">{matchResult.recommendation}</span>
              </div>
              {matchResult.matched_skills.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-muted block mb-1.5">Matched skills</span>
                  <div className="flex flex-wrap gap-1.5">{matchResult.matched_skills.map((s) => <SkillTag key={s} skill={s} variant="matched" />)}</div>
                </div>
              )}
              {matchResult.missing_required_skills.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-muted block mb-1.5">Missing skills</span>
                  <div className="flex flex-wrap gap-1.5">{matchResult.missing_required_skills.map((s) => <SkillTag key={s} skill={s} variant="missing" />)}</div>
                </div>
              )}
              <p className="text-xs text-muted mt-2">{matchResult.reasoning}</p>
            </Card>
          )}

          {/* AI Explanation */}
          {explanation && (
            <Card>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles size={14} className="text-accent-violet" /> AI Analysis</h4>
              <p className="text-sm text-muted mb-4">{explanation.summary}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-success font-medium">Strengths</span>
                  <ul className="mt-1 space-y-1">{explanation.strengths.map((s, i) => <li key={i} className="text-xs text-muted">✓ {s}</li>)}</ul>
                </div>
                <div>
                  <span className="text-xs text-danger font-medium">Weaknesses</span>
                  <ul className="mt-1 space-y-1">{explanation.weaknesses.map((w, i) => <li key={i} className="text-xs text-muted">✗ {w}</li>)}</ul>
                </div>
              </div>
              {explanation.improvement_suggestions.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs text-accent-cyan font-medium">Suggestions</span>
                  <ul className="mt-1 space-y-1">{explanation.improvement_suggestions.map((s, i) => <li key={i} className="text-xs text-muted">→ {s}</li>)}</ul>
                </div>
              )}
            </Card>
          )}

          {/* Cover letter */}
          {coverLetterMessage && (
            <Card>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><FileText size={14} className="text-accent-cyan" /> Cover Letter</h4>
              <p className="text-sm text-muted">{coverLetterMessage}</p>
            </Card>
          )}
        </div>

        {/* Right — Actions sidebar */}
        <div className="hyrra-section-stack">
          <Card>
            <h4 className="text-xs text-muted mb-3 font-medium">Resume</h4>
            {resumes.length === 0 ? (
              <p className="text-xs text-muted-dark">No resumes saved. <Link href="/resumes" className="text-accent-violet hover:underline">Add one</Link></p>
            ) : (
              <select
                value={selectedResumeId ?? ""}
                onChange={(e) => setSelectedResumeId(Number(e.target.value))}
                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:border-accent-violet focus:outline-none"
              >
                {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </Card>

          <div className="hyrra-section-stack">
            <GradientButton className="w-full" onClick={handleMatch} disabled={matching || !selectedResumeId}>
              <GitCompareArrows size={14} /> {matching ? "Matching…" : "Run Match"}
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={() => openAiAction("explain")} disabled={!selectedResumeId}>
              <Sparkles size={14} /> Explain Match
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={() => openAiAction("cover")} disabled={!selectedResumeId}>
              <FileText size={14} /> Cover Letter
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={handleTrack} disabled={tracking || tracked}>
              <ClipboardList size={14} /> {tracked ? "Tracked ✓" : tracking ? "Tracking…" : "Track Application"}
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={openEditModal}>
              <Pencil size={14} /> Edit Job
            </GradientButton>
            <GradientButton variant="ghost" className="w-full opacity-50 cursor-not-allowed" disabled>
              Improve Resume · Soon
            </GradientButton>
            <div className="pt-4 mt-4 border-t border-white/5">
              <GradientButton variant="ghost" className="w-full text-danger hover:text-danger hover:bg-danger/10" onClick={handleDeleteJob}>
                <Trash2 size={14} /> Delete Job
              </GradientButton>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      <Modal open={apiKeyModal} onClose={() => setApiKeyModal(false)} title={aiAction === "explain" ? "Enter OpenAI Key" : "Enter OpenAI Key"}>
        <div className="space-y-4">
          <p className="text-xs text-muted">Your key is used for this request only and is not stored.</p>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full"
          />
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
          <div className="flex justify-end gap-3">
            <GradientButton variant="secondary" onClick={() => setApiKeyModal(false)}>Cancel</GradientButton>
            <GradientButton onClick={runAiAction} disabled={aiLoading || !apiKey.trim()}>
              {aiLoading ? "Generating…" : aiAction === "explain" ? "Explain" : "Generate"}
            </GradientButton>
          </div>
        </div>
      </Modal>

      {/* Generate Outreach Draft Modal */}
      <Modal open={generationModalOpen} onClose={() => setGenerationModalOpen(false)} title="Generate Outreach Draft" wide>
        <div className="space-y-4">
          <p className="text-xs text-muted">Create a personalized draft using this job, contact, resume, and match context. You review and send it yourself.</p>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{generationContact?.name || "No contact selected"}</span>
              {generationContact?.title && <span className="text-xs text-muted">{generationContact.title}</span>}
              {generationContact?.company && <span className="text-xs text-muted">{generationContact.company}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">Hyrra generates a draft only. It will not contact anyone automatically.</p>
          </div>

          <div className="hyrra-form-grid">
            <div>
              <label className="text-xs text-muted mb-1 block">Message type</label>
              <select
                value={generationType}
                onChange={(e) => setGenerationType(e.target.value as OutreachMessageType)}
                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Resume context</label>
              <select
                value={generationResumeId ?? ""}
                onChange={(e) => setGenerationResumeId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                <option value="">No resume context</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>{resume.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">OpenAI API Key</label>
            <input
              type="text"
              value={generationApiKey}
              onChange={(e) => setGenerationApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full"
            />
            <p className="text-[10px] text-muted-dark mt-1">Your key is used for this request only and is not stored.</p>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Extra context</label>
            <textarea
              rows={4}
              value={generationExtraContext}
              onChange={(e) => setGenerationExtraContext(e.target.value)}
              placeholder="Optional: mention that you applied, what angle to use, or any prior context."
              className="w-full resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={generationSaveAsDraft}
              onChange={(e) => setGenerationSaveAsDraft(e.target.checked)}
            />
            Save as draft
          </label>
          <p className="text-[10px] text-muted-dark">Saved drafts appear in Outreach Messages. Hyrra will not send anything.</p>

          {generationResumeId && generationMatchId && (
            <p className="text-[10px] text-muted-dark">Using current match result for {selectedGenerationResume?.name || "selected resume"}.</p>
          )}

          {generationError && <p className="text-xs text-danger">{generationError}</p>}

          {generatedMessage && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Generated Draft</h4>
                  {generatedMessage.message_id ? (
                    <p className="text-xs text-muted">Saved as draft #{generatedMessage.message_id}</p>
                  ) : (
                    <p className="text-xs text-muted">Not saved. Copy it before closing if you want to use it.</p>
                  )}
                </div>
                <GradientButton size="sm" variant="secondary" onClick={copyGeneratedMessage}>
                  <Copy size={12} /> Copy Message
                </GradientButton>
              </div>
              {generationCopySuccess && <p className="text-xs text-success mb-3">{generationCopySuccess}</p>}
              {generatedMessage.subject && (
                <div className="mb-3">
                  <label className="text-xs text-muted mb-1 block">Subject</label>
                  <div className="rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-sm text-foreground break-words">{generatedMessage.subject}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-muted mb-1 block">Body</label>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-sm text-muted leading-relaxed whitespace-pre-wrap break-words">
                  {generatedMessage.body}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setGenerationModalOpen(false)}>{generatedMessage ? "Close" : "Cancel"}</GradientButton>
            <GradientButton onClick={runOutreachGeneration} disabled={generationLoading}>
              {generationLoading ? "Generating..." : "Generate Draft"}
            </GradientButton>
          </div>
        </div>
      </Modal>

      {/* Outreach Contact Modal */}
      <Modal open={contactModalOpen} onClose={() => setContactModalOpen(false)} title={editingContact ? "Edit Contact" : "Add Contact"} wide>
        <div className="space-y-4">
          <div className="hyrra-form-grid">
            <div>
              <label className="text-xs text-muted mb-1 block">Name *</label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Title</label>
              <input
                type="text"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Company</label>
              <input
                type="text"
                value={contactForm.company}
                onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Email</label>
              <input
                type="text"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">LinkedIn URL</label>
              <input
                type="text"
                value={contactForm.linkedin_url}
                onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Source</label>
              <input
                type="text"
                value={contactForm.source}
                onChange={(e) => setContactForm({ ...contactForm, source: e.target.value })}
                placeholder="e.g. LinkedIn, company team page"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Confidence score</label>
            <input
              type="text"
              value={contactForm.confidence_score}
              onChange={(e) => setContactForm({ ...contactForm, confidence_score: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Notes</label>
            <textarea
              rows={4}
              value={contactForm.notes}
              onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              className="w-full resize-none"
            />
          </div>
          {contactError && <p className="text-xs text-danger">{contactError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setContactModalOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleSaveContact} disabled={contactSaving}>
              {contactSaving ? "Saving..." : editingContact ? "Save Changes" : "Add Contact"}
            </GradientButton>
          </div>
        </div>
      </Modal>

      {/* Edit Job Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Job" wide>
        <div className="space-y-4">
          <div className="hyrra-form-grid">
            <div>
              <label className="text-xs text-muted mb-1 block">Title</label>
              <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Company</label>
              <input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Location</label>
              <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Employment type</label>
              <input type="text" value={editForm.employment_type} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })} className="w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Source label</label>
            <input type="text" value={editForm.source_label} onChange={(e) => setEditForm({ ...editForm, source_label: e.target.value })} placeholder="e.g. LinkedIn, Internal Career Page" className="w-full" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Raw job text</label>
            <textarea
              rows={10}
              value={editForm.raw_text}
              onChange={(e) => setEditForm({ ...editForm, raw_text: e.target.value })}
              className="w-full resize-none"
            />
          </div>
          {editError && <p className="text-xs text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleUpdateJob} disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
