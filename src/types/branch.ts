export interface BranchCreate {
  /** The branch id, matches the git branch's name with [/_] replaced by - */
  id: string
  name?: string
  repo: string
}

export interface BranchRead {
  /** The branch id, matches the git branch's name with [/_] replaced by - */
  id: string
  name: string
  repo: string
}
