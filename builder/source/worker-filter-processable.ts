import * as AGTree from '@adguard/agtree'
import * as Fs from 'node:fs'

export default function FilterProcessable(FileName: string) {
  const FiltersRaw = Fs.readFileSync(FileName, 'utf-8')
  const FilterTree = AGTree.FilterListParser.parse(FiltersRaw, { parseUboSpecificRules: true })
  const Result = FilterTree.children.filter(Child => {
    return typeof Child.category === 'string' && (Child.category !== 'Empty' && Child.category !== 'Comment')
  }).length > 0
  return { Result, FileName }
}