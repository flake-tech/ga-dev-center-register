export type CommitRead = {
  /** The commit ID, matches the commit hash */
  id: string
  createdAt: Date
  updatedAt: Date
  /** The commit name, matches the first line of the commit message */
  name: string
  branchId: string
  /** The commit description, matches the full commit message */
  description: string
}

export type CommitCreate = {
  /** The commit ID, matches the commit hash */
  id: string
  /** The commit name, matches the first line of the commit message */
  name: string
  branchId: string
  /** The commit description, matches the full commit message */
  description: string
  author?: string
}
