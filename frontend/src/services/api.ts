const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

type RequestOptions = RequestInit & {
  params?: Record<
    string,
    string | number | boolean | null | undefined
  >;
};

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    params,
    headers,
    ...fetchOptions
  } = options;

  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams =
      new URLSearchParams();

    Object.entries(params).forEach(
      ([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          searchParams.set(
            key,
            String(value),
          );
        }
      },
    );

    const query =
      searchParams.toString();

    if (query) {
      url += `?${query}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,

    credentials: "include",

    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    let message =
      `API request failed: ${response.status}`;

    try {
      const error =
        await response.json();

      if (
        typeof error?.detail ===
        "string"
      ) {
        message = error.detail;
      }
    } catch {
      // Ignore invalid error JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) || "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}

export type UserRole =
  | "STUDENT"
  | "PROFESSOR"
  | "ADMIN"
  | "DEVELOPER"
  | "SUPER_ADMIN"
  | "USER"
  | null;

export interface AuthUser {
  user_id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  profile_completed: boolean;
  verification_status: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  next_step: string;
}

export const apiRequest = request;

export const api = {
  auth: {
    login() {
      window.location.href =
        `${API_BASE_URL}/auth/google`;
    },

    me() {
      return request<AuthUser>(
        "/auth/me",
      );
    },

    logout() {
      return request<{
        message: string;
      }>("/auth/logout", {
        method: "POST",
      });
    },
  },

  health() {
    return request<{
      status: string;
    }>("/health");
  },

  dashboard: {
    get() {
      return request(
        "/dashboard/",
      );
    },
  },

  timetable: {
    get(day?: string) {
      return request(
        "/timetable/",
        {
          params: { day },
        },
      );
    },
  },

  results: {
    list() {
      return request(
        "/results/",
      );
    },
  },

  events: {
    list() {
      return request(
        "/events/",
      );
    },

    get(eventId: number) {
      return request(
        `/events/${eventId}`,
      );
    },
  },

  marketplace: {
    listProducts(params?: {
      institution_id?: number;
      category?: string;
      product_type?: string;
      search?: string;
    }) {
      return request(
        "/marketplace/",
        { params },
      );
    },

    getProduct(productId: number) {
      return request(
        `/marketplace/${productId}`,
      );
    },

    cart: {
      get() {
        return request(
          "/marketplace/cart",
        );
      },

      add(
        productId: number,
        quantity = 1,
      ) {
        return request(
          "/marketplace/cart",
          {
            method: "POST",
            params: {
              product_id: productId,
              quantity,
            },
          },
        );
      },
    },
  },

  courses: {
    list(institutionId?: number) {
      return request(
        "/courses/",
        {
          params: {
            institution_id:
              institutionId,
          },
        },
      );
    },
  },

  attendance: {
    getStudent(
      studentId: number,
      courseId?: number,
    ) {
      return request(
        `/attendance/student/${studentId}`,
        {
          params: {
            course_id: courseId,
          },
        },
      );
    },
  },

  ai: {
    home() {
      return request("/ai/");
    },

    ask(data: {
      message: string;
      course_id?: number | null;
      context?: string | null;
    }) {
      return request(
        "/ai/ask",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(data),
        },
      );
    },
  },

  protected: {
    platform() {
      return request(
        "/protected/platform",
      );
    },

    superAdmin() {
      return request(
        "/protected/super-admin",
      );
    },
  },
};

export default api;