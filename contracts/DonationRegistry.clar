(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DONATION-ID u101)
(define-constant ERR-INVALID-FOOD-TYPE u102)
(define-constant ERR-INVALID-QUANTITY u103)
(define-constant ERR-INVALID-TIMESTAMP u104)
(define-constant ERR-DONATION-ALREADY-EXISTS u105)
(define-constant ERR-DONATION-NOT-FOUND u106)
(define-constant ERR-INVALID-STATUS u107)
(define-constant ERR-INVALID-DESCRIPTION u108)
(define-constant ERR-INVALID-LOCATION u109)
(define-constant ERR-INVALID-CURRENCY u110)
(define-constant ERR-INVALID-UPDATE-PARAM u111)
(define-constant ERR-MAX-DONATIONS-EXCEEDED u112)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u113)
(define-constant ERR-INVALID-EXPIRY u114)
(define-constant ERR-INVALID-RECIPIENT u115)
(define-constant ERR_UPDATE-NOT-ALLOWED u116)

(define-data-var next-donation-id uint u0)
(define-data-var max-donations uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map donations
  uint
  {
    donation-id: (buff 32),
    restaurant: principal,
    food-type: (string-ascii 50),
    quantity: uint,
    timestamp: uint,
    status: bool,
    description: (string-utf8 200),
    location: (string-ascii 100),
    currency: (string-ascii 20),
    expiry: uint,
    recipient: (optional principal)
  }
)

(define-map donations-by-hash
  (buff 32)
  uint)

(define-map donation-updates
  uint
  {
    update-food-type: (string-ascii 50),
    update-quantity: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-donation (id uint))
  (map-get? donations id)
)

(define-read-only (get-donation-updates (id uint))
  (map-get? donation-updates id)
)

(define-read-only (is-donation-registered (hash (buff 32)))
  (is-some (map-get? donations-by-hash hash))
)

(define-private (validate-donation-id (id (buff 32)))
  (if (> (len id) u0)
      (ok true)
      (err ERR-INVALID-DONATION-ID))
)

(define-private (validate-food-type (ftype (string-ascii 50)))
  (if (and (> (len ftype) u0) (<= (len ftype) u50))
      (ok true)
      (err ERR-INVALID-FOOD-TYPE))
)

(define-private (validate-quantity (qty uint))
  (if (> qty u0)
      (ok true)
      (err ERR-INVALID-QUANTITY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-status (stat bool))
  (ok true)
)

(define-private (validate-description (desc (string-utf8 200)))
  (if (<= (len desc) u200)
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-expiry (exp uint))
  (if (> exp block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-recipient (rec (optional principal)))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-donations (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-DONATIONS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-donations new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-donation
  (donation-hash (buff 32))
  (food-type (string-ascii 50))
  (quantity uint)
  (description (string-utf8 200))
  (location (string-ascii 100))
  (currency (string-ascii 20))
  (expiry uint)
  (recipient (optional principal))
)
  (let (
        (next-id (var-get next-donation-id))
        (current-max (var-get max-donations))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-DONATIONS-EXCEEDED))
    (try! (validate-donation-id donation-hash))
    (try! (validate-food-type food-type))
    (try! (validate-quantity quantity))
    (try! (validate-description description))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-expiry expiry))
    (try! (validate-recipient recipient))
    (asserts! (is-none (map-get? donations-by-hash donation-hash)) (err ERR-DONATION-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set donations next-id
      {
        donation-id: donation-hash,
        restaurant: tx-sender,
        food-type: food-type,
        quantity: quantity,
        timestamp: block-height,
        status: true,
        description: description,
        location: location,
        currency: currency,
        expiry: expiry,
        recipient: recipient
      }
    )
    (map-set donations-by-hash donation-hash next-id)
    (var-set next-donation-id (+ next-id u1))
    (print { event: "donation-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-donation
  (donation-id uint)
  (update-food-type (string-ascii 50))
  (update-quantity uint)
)
  (let ((donation (map-get? donations donation-id)))
    (match donation
      d
        (begin
          (asserts! (is-eq (get restaurant d) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-food-type update-food-type))
          (try! (validate-quantity update-quantity))
          (map-set donations donation-id
            {
              donation-id: (get donation-id d),
              restaurant: (get restaurant d),
              food-type: update-food-type,
              quantity: update-quantity,
              timestamp: block-height,
              status: (get status d),
              description: (get description d),
              location: (get location d),
              currency: (get currency d),
              expiry: (get expiry d),
              recipient: (get recipient d)
            }
          )
          (map-set donation-updates donation-id
            {
              update-food-type: update-food-type,
              update-quantity: update-quantity,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "donation-updated", id: donation-id })
          (ok true)
        )
      (err ERR-DONATION-NOT-FOUND)
    )
  )
)

(define-public (set-donation-status (donation-id uint) (new-status bool))
  (let ((donation (map-get? donations donation-id)))
    (match donation
      d
        (begin
          (asserts! (is-eq (get restaurant d) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-status new-status))
          (map-set donations donation-id
            (merge d { status: new-status })
          )
          (ok true)
        )
      (err ERR-DONATION-NOT-FOUND)
    )
  )
)

(define-public (assign-recipient (donation-id uint) (new-recipient principal))
  (let ((donation (map-get? donations donation-id)))
    (match donation
      d
        (begin
          (asserts! (is-eq (get restaurant d) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-principal new-recipient))
          (map-set donations donation-id
            (merge d { recipient: (some new-recipient) })
          )
          (ok true)
        )
      (err ERR-DONATION-NOT-FOUND)
    )
  )
)

(define-public (get-donation-count)
  (ok (var-get next-donation-id))
)

(define-public (check-donation-existence (hash (buff 32)))
  (ok (is-donation-registered hash))
)