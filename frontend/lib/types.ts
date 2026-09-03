export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  position: number;
  tasks: Task[];
}

export interface BoardMember {
  id: string;
  userId: string;
  user: AuthUser;
}

export interface BoardSummary {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
}

export interface BoardDetail extends BoardSummary {
  columns: Column[];
  owner: AuthUser;
  members: BoardMember[];
}
