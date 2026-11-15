import type { Transaction } from '../lib/db'
import { formatIDR } from '../lib/money'

interface TransactionRowProps {
  readonly transaction: Transaction
  readonly onEdit: (transaction: Transaction) => void
  readonly hideAmounts: boolean
}

export function TransactionRow({ transaction, onEdit, hideAmounts }: TransactionRowProps) {
  return (
    <li>
      <button type="button" className="row" onClick={() => onEdit(transaction)}>
        <span className="row-main">
          <span className="row-payee">{transaction.payee}</span>
          <span className="row-meta">
            {transaction.source}
            {transaction.note ? (
              <>
                <span aria-hidden="true"> · </span>
                {transaction.note}
              </>
            ) : null}
          </span>
        </span>
        <span className="row-side">
          <span className="row-amount mono">
            {formatIDR(transaction.amount, hideAmounts)}
          </span>
          <span className="row-number mono">{transaction.number}</span>
        </span>
      </button>
    </li>
  )
}
