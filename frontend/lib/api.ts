import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type Role = "admin" | "employee" | "partner";
export type TaskStatus = "pending" | "working" | "need_information" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type Agency = {
  id: string;
  name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  agency_id?: string | null;
  agency?: Agency | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  agency_id?: string | null;
  assigned_user_id?: string | null;
  created_by: string;
  due_date?: string | null;
  agency?: Agency | null;
  assigned_user?: User | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  task_id: string;
  sender_id: string;
  sender?: User | null;
  message: string;
  created_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  uploaded_by: string;
  uploader?: User | null;
  file_name: string;
  file_url: string;
  content_type?: string | null;
  size_bytes: number;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  task_id: string;
  user_id?: string | null;
  user?: User | null;
  action: string;
  created_at: string;
};

export type TaskDetail = Task & {
  messages: Message[];
  attachments: Attachment[];
  activity_logs: ActivityLog[];
};

export type Notification = {
  id: string;
  user_id: string;
  task_id?: string | null;
  type: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

export type DashboardStats = {
  total_tasks: number;
  pending_tasks: number;
  working_tasks: number;
  completed_tasks: number;
  total_agencies: number;
  recent_activity: ActivityLog[];
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export const statusOptions: TaskStatus[] = ["pending", "working", "need_information", "completed", "cancelled"];
export const priorityOptions: TaskPriority[] = ["low", "normal", "high", "urgent"];
export const roleOptions: Role[] = ["admin", "employee", "partner"];

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("access_token");
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("refresh_token");
}

export function setTokens(tokens: TokenResponse) {
  window.localStorage.setItem("access_token", tokens.access_token);
  window.localStorage.setItem("refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("refresh_token");
}

export function websocketUrl(taskId: string) {
  const token = getAccessToken();
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/tasks/${taskId}/ws?token=${encodeURIComponent(token ?? "")}`;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }
    try {
      original._retry = true;
      const { data } = await axios.post<TokenResponse>(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken
      });
      setTokens(data);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError) {
      clearTokens();
      return Promise.reject(refreshError);
    }
  }
);
