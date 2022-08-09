import { ChangeEvent, ForwardRefRenderFunction, forwardRef, useEffect, useState } from 'react'

import { NumberFormat } from '@/components/NumberFormat'
import { JoyTokenIcon } from '@/components/_icons/JoyTokenIcon'
import { Input, InputProps } from '@/components/_inputs/Input'
import { tokenNumberToHapiBn } from '@/joystream-lib/utils'
import { useTokenPrice } from '@/providers/joystream'

export type TokenInputProps = {
  value: number | null | undefined
  onChange: (value: number | null) => void
} & Omit<InputProps, 'value' | 'onChange' | 'nodeStart' | 'nodeEnd'>

const MAX_LENGTH = 15

const _TokenInput: ForwardRefRenderFunction<HTMLInputElement, TokenInputProps> = (
  { value, onChange, ...rest },
  ref
) => {
  const valueBN = value && tokenNumberToHapiBn(value)
  const { convertHapiToUSD } = useTokenPrice()
  const valueInUSD = valueBN && convertHapiToUSD(valueBN)

  const [internalValue, setInternalValue] = useState(value ? value.toString() : '')

  // react to external changes to value
  useEffect(() => {
    if ((value?.toString() || '') !== internalValue) {
      setInternalValue(value ? value.toString() : '')
    }
  }, [internalValue, value])

  return (
    <Input
      {...rest}
      ref={ref}
      type="number"
      nodeStart={<JoyTokenIcon variant="gray" size={24} />}
      nodeEnd={
        !!valueInUSD && (
          <NumberFormat as="span" variant="t300" format="dollar" color="colorTextMuted" value={valueInUSD} />
        )
      }
      value={internalValue}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const valueStr = event.target.value
        const valueNum = event.target.valueAsNumber

        if (valueStr.length < MAX_LENGTH) {
          setInternalValue(valueStr)
          onChange(valueNum)
        }
      }}
    />
  )
}

export const TokenInput = forwardRef(_TokenInput)
TokenInput.displayName = 'TokenInput'