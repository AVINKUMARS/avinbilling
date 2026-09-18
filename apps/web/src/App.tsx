import { ArrowRight, Boxes, Building2, CheckCircle2, FileText, Layers3, LoaderCircle, LogOut, Menu, PackageCheck, Sparkles, Users, WalletCards } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { moduleCatalog } from '@avin/module-registry';
import { ModuleCard } from './components/ModuleCard';
import { Workspace } from './components/Workspace';
import { useSetupStore } from './store/setup-store';

const setupSteps = ['Business', 'Modules', 'Industry packs', 'Administrator'];

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000/api/v1';

type SetupIndustryPack = {
  key: string;
  name: string;
  description: string;
  color: string;
  categories: unknown[];
  measurementFields: unknown[];
};

function SetupWizard({ onCreated }: { onCreated: () => void }) {
  const { enabledModules, industryPacks, toggleModule, togglePack } = useSetupStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationName, setOrganizationName] = useState('');
  const [adminName, setAdminName] = useState('Avinkumar Sureshkumar');
  const [adminEmail, setAdminEmail] = useState('avinkumar417@gmail.com');
  const [password, setPassword] = useState('');
  const [submission, setSubmission] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [availablePacks, setAvailablePacks] = useState<SetupIndustryPack[]>([]);

  useEffect(() => {
    void fetch(`${apiUrl}/platform/industry-packs`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load industry packs');
        return response.json() as Promise<{ data: SetupIndustryPack[] }>;
      })
      .then((result) => setAvailablePacks(result.data))
      .catch(() => setAvailablePacks([]));
  }, []);

  async function completeSetup(event?: FormEvent) {
    event?.preventDefault();
    setSubmission('submitting');
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          adminName,
          adminEmail,
          password,
          enabledModules,
          industryPacks,
        }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Setup failed');
      setSubmission('success');
      setMessage('Organization created successfully. The login workspace is ready for the next development step.');
      window.setTimeout(onCreated, 900);
    } catch (error) {
      setSubmission('error');
      setMessage(error instanceof Error ? error.message : 'Unable to complete setup');
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Layers3 size={21} />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-ink">Avin Business Suite</div>
              <div className="text-xs font-medium text-slate-500">Organization setup</div>
            </div>
          </div>
          <button className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 text-sm font-semibold text-slate-500 lg:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Foundation preview
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="px-2 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Setup progress</p>
            <ol className="space-y-1">
              {setupSteps.map((step, index) => (
                <li key={step} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${index === currentStep ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>
                  <span className={`grid size-7 place-items-center rounded-full text-xs ${index < currentStep ? 'bg-brand-600 text-white' : index === currentStep ? 'border-2 border-brand-600 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                    {index < currentStep ? <CheckCircle2 size={15} /> : index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl bg-slate-900 p-4 text-white">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Sparkles size={14} /> Modular by design
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">Only enabled modules appear for this organization. Dependencies are added automatically.</p>
            </div>
          </aside>

          <div>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold text-brand-600">Step {currentStep + 1} of 4</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-ink md:text-4xl">
                  {currentStep === 1
                    ? 'Choose how your business works.'
                    : currentStep === 2
                      ? 'Choose your industry packs.'
                      : 'Create the organization owner.'}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  {currentStep === 1
                    ? 'Start with the essentials. Operations and advanced modules can be enabled later without changing existing data.'
                    : currentStep === 2
                      ? 'Industry packs add ready-made measurements, calculations, workflows and documents to the modules you selected.'
                      : 'Enter the company and administrator details used for the first secure account.'}
                </p>
              </div>
              <div className={`${currentStep === 1 ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm`}>
                <span className="font-black text-brand-700">{enabledModules.length}</span>
                <span className="ml-1.5 text-slate-500">modules enabled</span>
              </div>
            </div>

            <div className={`${currentStep === 1 ? 'grid' : 'hidden'} mt-8 gap-4 sm:grid-cols-2 xl:grid-cols-3`}>
              {moduleCatalog.map((module) => (
                <ModuleCard
                  key={module.key}
                  module={module}
                  enabled={enabledModules.includes(module.key)}
                  onToggle={() => toggleModule(module.key)}
                />
              ))}
            </div>

            <section className={`${currentStep === 2 ? 'block' : 'hidden'} mt-8`}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {availablePacks.map((pack) => {
                  const enabled = industryPacks.includes(pack.key);
                  return (
                    <button
                      key={pack.key}
                      type="button"
                      onClick={() => togglePack(pack.key)}
                      className={`rounded-2xl border p-5 text-left shadow-card transition hover:-translate-y-0.5 ${enabled ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-11 place-items-center rounded-xl text-white" style={{ backgroundColor: pack.color }}>
                          {enabled ? <PackageCheck size={21} /> : <Boxes size={21} />}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${enabled ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {enabled ? 'Selected' : 'Select'}
                        </span>
                      </div>
                      <h2 className="mt-4 text-lg font-black tracking-tight text-ink">{pack.name}</h2>
                      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{pack.description}</p>
                      <div className="mt-4 flex gap-3 text-xs font-bold text-slate-500">
                        <span>{pack.categories.length} categories</span>
                        <span>{pack.measurementFields.length} fields</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {availablePacks.length === 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
                  Industry packs are still loading. Check that the API is running, then retry.
                </div>
              )}
              <p className="mt-4 text-sm text-slate-500">Choose one or more packs. You can install, disable, or add example products later from Settings without deleting existing business records.</p>
            </section>

            <form data-admin-form onSubmit={completeSetup} className={`${currentStep === 3 ? 'block' : 'hidden'} mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-card md:p-8`}>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-sm font-bold text-slate-700">Organization name</span>
                  <input
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    required
                    minLength={2}
                    placeholder="Example: Avin UPVC"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                <label>
                  <span className="text-sm font-bold text-slate-700">Administrator name</span>
                  <input
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                    required
                    minLength={2}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                <label>
                  <span className="text-sm font-bold text-slate-700">Administrator email</span>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="text-sm font-bold text-slate-700">Create password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={10}
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
              </div>
              {message && (
                <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${submission === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                  {message}
                </div>
              )}
            </form>

            <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
                disabled={currentStep === 1 || submission === 'submitting'}
                className="rounded-xl px-5 py-3 text-sm font-bold text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentStep < 3) setCurrentStep((step) => step + 1);
                  else document.querySelector<HTMLFormElement>('form[data-admin-form]')?.requestSubmit();
                }}
                disabled={submission === 'submitting' || submission === 'success' || (currentStep === 2 && industryPacks.length === 0)}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-default disabled:bg-brand-600 disabled:hover:translate-y-0"
              >
                {submission === 'submitting'
                  ? 'Creating organization…'
                  : submission === 'success'
                    ? 'Organization created'
                    : currentStep === 1
                      ? 'Continue to industry packs'
                      : currentStep === 2
                        ? 'Continue to administrator'
                        : 'Create organization'}
                {submission === 'submitting'
                  ? <LoaderCircle className="animate-spin" size={17} />
                  : submission === 'success'
                    ? <CheckCircle2 size={17} />
                    : <ArrowRight size={17} />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type AuthenticatedUser = { id: string; name: string; email: string };

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
        <Layers3 size={22} />
      </div>
      <div>
        <div className="font-extrabold tracking-tight text-ink">Avin Business Suite</div>
        <div className="text-xs font-medium text-slate-500">One platform. Every operation.</div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string, user: AuthenticatedUser) => void }) {
  const [email, setEmail] = useState('avinkumar417@gmail.com');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function login(event: FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as {
        data?: { token: string; user: AuthenticatedUser };
        error?: { message?: string };
      };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? 'Login failed');
      onLogin(result.data.token, result.data.user);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to sign in');
    }
  }

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <BrandHeader />
          <div className="mt-12">
            <p className="text-sm font-bold text-brand-600">Welcome back</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-ink">Sign in to your workspace.</h1>
            <p className="mt-3 leading-7 text-slate-600">Use the administrator account created during organization setup.</p>
          </div>
          <form onSubmit={login} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            {message && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
            <button disabled={status === 'submitting'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {status === 'submitting' ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
              {status === 'submitting' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-28 -top-24 size-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute bottom-24 left-20 size-64 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative max-w-xl">
          <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-white/10"><Sparkles /></div>
          <h2 className="text-4xl font-black leading-tight">From first enquiry to final payment—in one connected workspace.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">Projects, brands, measurements, quotations, production and finance stay connected without duplicate entry.</p>
        </div>
      </section>
    </main>
  );
}

function InvitationAcceptanceScreen({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function accept(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      const response = await fetch(`${apiUrl}/auth/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Unable to accept invitation');
      setStatus('success');
      setMessage('Your account is ready. You can now sign in.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to accept invitation');
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-card md:p-9">
        <BrandHeader />
        <p className="mt-10 text-sm font-bold text-brand-600">Team invitation</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Create your password.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Accept the invitation to join this Avin Business Suite organization.</p>
        {status === 'success' ? (
          <div className="mt-7">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>
            <button
              type="button"
              onClick={() => {
                window.history.replaceState({}, '', window.location.pathname);
                window.location.reload();
              }}
              className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white"
            >
              Continue to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={accept} className="mt-7 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              placeholder="Password (minimum 8 characters)"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5"
            />
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
              placeholder="Confirm password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5"
            />
            {message && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
            <button disabled={status === 'submitting'} className="w-full rounded-xl bg-brand-600 px-5 py-3.5 font-bold text-white disabled:opacity-50">
              {status === 'submitting' ? 'Creating account…' : 'Accept invitation'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => void }) {
  const cards = [
    { label: 'Customers', value: '0', note: 'Ready to add', icon: Users },
    { label: 'Active projects', value: '0', note: 'No projects yet', icon: Building2 },
    { label: 'Open quotations', value: '0', note: 'Start your first quote', icon: FileText },
    { label: 'Outstanding', value: '₹0', note: 'No pending payments', icon: WalletCards },
  ];

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <BrandHeader />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold text-ink">{user.name}</div>
              <div className="text-xs text-slate-500">Organization owner</div>
            </div>
            <button onClick={onLogout} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <p className="text-sm font-bold text-brand-600">Organization dashboard</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Good to see you, {user.name.split(' ')[0]}.</h1>
        <p className="mt-2 text-slate-600">Your workspace is connected to MongoDB and ready for business data.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, note, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-600">{label}</span><Icon className="text-brand-600" size={20} /></div>
              <div className="mt-5 text-3xl font-black text-ink">{value}</div>
              <div className="mt-1 text-xs text-slate-500">{note}</div>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-3xl bg-slate-900 p-7 text-white md:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Next implementation</p>
          <h2 className="mt-3 text-2xl font-black">Build the working customer and project workspace.</h2>
          <p className="mt-2 max-w-2xl leading-7 text-slate-300">The secure foundation is active. Customer, brand, project, measurement and quotation screens come next.</p>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('avin_token'));
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const stored = localStorage.getItem('avin_user');
    return stored ? JSON.parse(stored) as AuthenticatedUser : null;
  });

  useEffect(() => {
    fetch(`${apiUrl}/auth/setup-status`)
      .then((response) => response.json())
      .then((result: { data?: { bootstrapped?: boolean } }) => setBootstrapped(Boolean(result.data?.bootstrapped)))
      .catch(() => setBootstrapped(false))
      .finally(() => setLoading(false));
  }, []);

  const invitationToken = new URLSearchParams(window.location.search).get('token');
  if (window.location.pathname === '/accept-invitation' && invitationToken) {
    return <InvitationAcceptanceScreen token={invitationToken} />;
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-canvas"><LoaderCircle className="animate-spin text-brand-600" size={34} /></main>;
  }

  if (token && user) {
    return <Workspace user={user} onLogout={() => {
      localStorage.removeItem('avin_token');
      localStorage.removeItem('avin_user');
      setToken(null);
      setUser(null);
    }} />;
  }

  if (bootstrapped) {
    return <LoginScreen onLogin={(nextToken, nextUser) => {
      localStorage.setItem('avin_token', nextToken);
      localStorage.setItem('avin_user', JSON.stringify(nextUser));
      setToken(nextToken);
      setUser(nextUser);
    }} />;
  }

  return <SetupWizard onCreated={() => setBootstrapped(true)} />;
}
